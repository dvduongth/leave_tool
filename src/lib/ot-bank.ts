import prisma from "@/lib/prisma";
import {
  CYCLE_START_MONTH,
  CYCLE_START_DAY,
  GRACE_PERIOD_MONTHS,
} from "@/lib/constants";
import type { OTBalance } from "@/generated/prisma";

export interface CycleBounds {
  cycleYear: number;
  cycleStart: Date;
  cycleEnd: Date;
  graceDeadline: Date;
}

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type DbClient = typeof prisma | TxClient;

/**
 * Compute the OT bank cycle bounds containing the given date.
 * Cycle: June 1st of cycleYear → May 31st of cycleYear+1, grace +2 months.
 */
export function computeCycleForDate(date: Date): CycleBounds {
  const y = date.getUTCFullYear();
  const startThisYear = new Date(Date.UTC(y, CYCLE_START_MONTH - 1, CYCLE_START_DAY));
  const cycleYear = date >= startThisYear ? y : y - 1;
  const cycleStart = new Date(Date.UTC(cycleYear, CYCLE_START_MONTH - 1, CYCLE_START_DAY));
  const cycleEnd = new Date(Date.UTC(cycleYear + 1, CYCLE_START_MONTH - 1, CYCLE_START_DAY - 1));
  const graceDeadline = new Date(
    Date.UTC(cycleYear + 1, CYCLE_START_MONTH - 1 + GRACE_PERIOD_MONTHS, CYCLE_START_DAY - 1)
  );
  return { cycleYear, cycleStart, cycleEnd, graceDeadline };
}

/**
 * Find or create the OTBalance row for the cycle containing `date`.
 * Idempotent — safe to call many times for the same (employeeId, cycleYear).
 */
export async function findOrCreateOTBalance(
  db: DbClient,
  employeeId: string,
  date: Date
): Promise<OTBalance> {
  const bounds = computeCycleForDate(date);
  const existing = await db.oTBalance.findUnique({
    where: { employeeId_cycleYear: { employeeId, cycleYear: bounds.cycleYear } },
  });
  if (existing) return existing;
  return db.oTBalance.create({
    data: {
      employeeId,
      cycleYear: bounds.cycleYear,
      cycleStart: bounds.cycleStart,
      cycleEnd: bounds.cycleEnd,
      graceDeadline: bounds.graceDeadline,
      totalMinutes: 0,
      usedMinutes: 0,
      pendingMinutes: 0,
    },
  });
}

/**
 * Increment totalMinutes on the OTBalance matching `otDate` and tag the OTRecord.
 * Called when an OTRecord transitions PENDING → APPROVED.
 */
export async function accrueOTBank(
  db: DbClient,
  otRecordId: string,
  employeeId: string,
  otDate: Date,
  otMinutes: number
): Promise<{ otBalanceId: string; cycleYear: number }> {
  const balance = await findOrCreateOTBalance(db, employeeId, otDate);
  await db.oTBalance.update({
    where: { id: balance.id },
    data: { totalMinutes: { increment: otMinutes } },
  });
  await db.oTRecord.update({
    where: { id: otRecordId },
    data: { otBalanceId: balance.id },
  });
  return { otBalanceId: balance.id, cycleYear: balance.cycleYear };
}

/**
 * Reverse an accrual — used when an admin rolls back an APPROVED OTRecord.
 * Decrements `totalMinutes` (clamped at 0 to prevent negative if used twice).
 */
export async function reverseOTAccrual(
  db: DbClient,
  otRecordId: string,
  otBalanceId: string,
  otMinutes: number
): Promise<void> {
  // Clamp to 0 via raw SQL to avoid negative totals on double-revert
  await db.$executeRaw`
    UPDATE ot_balances
    SET total_minutes = GREATEST(0, total_minutes - ${otMinutes})
    WHERE id = ${otBalanceId}
  `;
  await db.oTRecord.update({
    where: { id: otRecordId },
    data: { otBalanceId: null },
  });
}

/**
 * Atomically consume up to `requestedMinutes` from the employee's OT bank,
 * draining the grace cycle first (which is about to expire), then the current
 * cycle. Writes one LeaveOTConsumption row per balance touched.
 *
 * Uses raw SQL with conditional UPDATE so two concurrent approvals can't
 * over-consume the same balance.
 *
 * Returns the actual minutes consumed and the per-balance breakdown.
 */
export async function consumeOTBank(
  db: TxClient,
  leaveRequestId: string,
  employeeId: string,
  requestedMinutes: number,
  asOf: Date = new Date()
): Promise<{ consumedMinutes: number; consumptions: { otBalanceId: string; minutes: number }[] }> {
  if (requestedMinutes <= 0) {
    return { consumedMinutes: 0, consumptions: [] };
  }

  const balances = await db.oTBalance.findMany({
    where: {
      employeeId,
      OR: [
        { cycleStart: { lte: asOf }, cycleEnd: { gte: asOf } },
        { cycleEnd: { lt: asOf }, graceDeadline: { gte: asOf } },
      ],
    },
    // Grace (older) first → current
    orderBy: { cycleYear: "asc" },
  });

  let remaining = requestedMinutes;
  const consumptions: { otBalanceId: string; minutes: number }[] = [];

  for (const b of balances) {
    if (remaining <= 0) break;
    const available = b.totalMinutes - b.usedMinutes - b.pendingMinutes;
    if (available <= 0) continue;
    const take = Math.min(remaining, available);

    // Atomic conditional update — guards against race
    const rows = await db.$executeRaw`
      UPDATE ot_balances
      SET used_minutes = used_minutes + ${take}
      WHERE id = ${b.id}
        AND total_minutes - used_minutes - pending_minutes >= ${take}
    `;

    if (rows === 0) {
      // Lost the race; another approval consumed this balance. Try next.
      continue;
    }

    await db.leaveOTConsumption.create({
      data: { leaveRequestId, otBalanceId: b.id, minutes: take },
    });
    consumptions.push({ otBalanceId: b.id, minutes: take });
    remaining -= take;
  }

  return {
    consumedMinutes: requestedMinutes - remaining,
    consumptions,
  };
}

/**
 * Restores OT consumed by a leave (used on cancel/reject of an APPROVED leave).
 * Decrements `usedMinutes` per consumption row and deletes the rows.
 */
export async function restoreOTConsumption(
  db: TxClient,
  leaveRequestId: string
): Promise<{ restoredMinutes: number }> {
  const rows = await db.leaveOTConsumption.findMany({
    where: { leaveRequestId },
  });
  if (rows.length === 0) return { restoredMinutes: 0 };

  let total = 0;
  for (const r of rows) {
    await db.$executeRaw`
      UPDATE ot_balances
      SET used_minutes = GREATEST(0, used_minutes - ${r.minutes})
      WHERE id = ${r.otBalanceId}
    `;
    total += r.minutes;
  }
  await db.leaveOTConsumption.deleteMany({ where: { leaveRequestId } });
  return { restoredMinutes: total };
}

/**
 * Apply approval: greedy-consume OT bank for `totalHours`, then deduct any
 * remainder from the employee's LeaveBalance. Tagged via LeaveOTConsumption
 * for accurate restore. Atomic — runs in a single $transaction.
 */
export async function applyLeaveApproval(params: {
  leaveRequestId: string;
  employeeId: string;
  totalHours: number;
  balanceId: string | null;
  asOf?: Date;
}): Promise<{ otConsumedMinutes: number; leaveHoursDeducted: number }> {
  const { leaveRequestId, employeeId, totalHours, balanceId } = params;
  const asOf = params.asOf ?? new Date();
  const totalMinutes = Math.round(totalHours * 60);

  return prisma.$transaction(async (tx) => {
    const otResult = await consumeOTBank(tx, leaveRequestId, employeeId, totalMinutes, asOf);
    const leaveMinutesRemaining = totalMinutes - otResult.consumedMinutes;
    const leaveHoursToDeduct = leaveMinutesRemaining / 60;

    if (leaveHoursToDeduct > 0 && balanceId) {
      // Deduct from grace balance first (mirrors deductLeave logic)
      const balances = await tx.leaveBalance.findMany({
        where: {
          employeeId,
          OR: [
            { cycleStart: { lte: asOf }, cycleEnd: { gte: asOf } },
            { cycleEnd: { lt: asOf }, graceDeadline: { gte: asOf } },
          ],
        },
        orderBy: { cycleYear: "asc" },
      });

      let remaining = leaveHoursToDeduct;
      for (const b of balances) {
        if (remaining <= 0) break;
        const available = b.totalHours - b.usedHours - b.pendingHours;
        if (available <= 0) continue;
        const take = Math.min(remaining, available);
        await tx.leaveBalance.update({
          where: { id: b.id },
          data: { usedHours: { increment: take } },
        });
        remaining -= take;
      }

      if (remaining > 0) {
        throw new Error(
          `Insufficient leave balance after OT consume: requested ${leaveHoursToDeduct}h, available ${leaveHoursToDeduct - remaining}h`
        );
      }
    }

    // Reduce pendingHours on the originally-tagged balance (set when leave was submitted)
    if (balanceId) {
      await tx.leaveBalance.update({
        where: { id: balanceId },
        data: { pendingHours: { decrement: totalHours } },
      });
    }

    await tx.leaveRequest.update({
      where: { id: leaveRequestId },
      data: { otConsumedMinutes: otResult.consumedMinutes },
    });

    return {
      otConsumedMinutes: otResult.consumedMinutes,
      leaveHoursDeducted: leaveHoursToDeduct,
    };
  });
}

/**
 * Reverse an approval: restore consumed OT and refund leave balance hours.
 * Used by cancel/reject-cancel paths.
 */
export async function reverseLeaveApproval(params: {
  leaveRequestId: string;
  employeeId: string;
  totalHours: number;
  asOf?: Date;
}): Promise<{ otRestoredMinutes: number; leaveHoursRefunded: number }> {
  const { leaveRequestId, employeeId, totalHours } = params;
  const asOf = params.asOf ?? new Date();

  return prisma.$transaction(async (tx) => {
    const restored = await restoreOTConsumption(tx, leaveRequestId);
    const otRestoredMinutes = restored.restoredMinutes;
    const leaveHoursRefunded = totalHours - otRestoredMinutes / 60;

    if (leaveHoursRefunded > 0) {
      // Refund into the original balance(s) — find active balances and reverse usedHours
      const balances = await tx.leaveBalance.findMany({
        where: {
          employeeId,
          OR: [
            { cycleStart: { lte: asOf }, cycleEnd: { gte: asOf } },
            { cycleEnd: { lt: asOf }, graceDeadline: { gte: asOf } },
          ],
        },
        orderBy: { cycleYear: "desc" },
      });

      let remaining = leaveHoursRefunded;
      for (const b of balances) {
        if (remaining <= 0) break;
        const refund = Math.min(remaining, b.usedHours);
        if (refund <= 0) continue;
        await tx.$executeRaw`
          UPDATE leave_balances
          SET used_hours = GREATEST(0, used_hours - ${refund})
          WHERE id = ${b.id}
        `;
        remaining -= refund;
      }
    }

    return { otRestoredMinutes, leaveHoursRefunded };
  });
}

/**
 * Get all active OT balances for an employee — current cycle + grace cycle (if still within graceDeadline).
 */
export async function getActiveOTBalances(
  employeeId: string,
  asOf: Date = new Date()
): Promise<{ current: OTBalance; grace?: OTBalance; totalRemainingMinutes: number }> {
  const balances = await prisma.oTBalance.findMany({
    where: {
      employeeId,
      OR: [
        { cycleStart: { lte: asOf }, cycleEnd: { gte: asOf } },
        { cycleEnd: { lt: asOf }, graceDeadline: { gte: asOf } },
      ],
    },
    orderBy: { cycleYear: "desc" },
  });

  if (balances.length === 0) {
    // Auto-create current cycle if missing
    const created = await findOrCreateOTBalance(prisma, employeeId, asOf);
    return {
      current: created,
      totalRemainingMinutes: 0,
    };
  }

  const current = balances[0];
  const grace = balances.length > 1 ? balances[1] : undefined;
  const remaining = (b: OTBalance) => b.totalMinutes - b.usedMinutes - b.pendingMinutes;
  return {
    current,
    grace,
    totalRemainingMinutes: remaining(current) + (grace ? remaining(grace) : 0),
  };
}
