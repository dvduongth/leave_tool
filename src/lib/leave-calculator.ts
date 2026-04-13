import prisma from "@/lib/prisma";

/**
 * Gets the active leave balance(s) for an employee on a given date.
 * Considers the grace period: if the date is within graceDeadline of the previous cycle,
 * that balance is also available.
 */
export async function getActiveBalance(
  employeeId: string,
  date: Date
): Promise<{ currentBalance: ActiveBalance; graceBalance?: ActiveBalance }> {
  // Find the current cycle balance (date falls within cycleStart..cycleEnd)
  const balances = await prisma.leaveBalance.findMany({
    where: {
      employeeId,
      OR: [
        // Current cycle: date is within cycle range
        {
          cycleStart: { lte: date },
          cycleEnd: { gte: date },
        },
        // Grace period: previous cycle whose graceDeadline hasn't passed
        {
          cycleEnd: { lt: date },
          graceDeadline: { gte: date },
        },
      ],
    },
    orderBy: { cycleYear: "desc" },
  });

  if (balances.length === 0) {
    throw new Error(
      `No active leave balance found for employee ${employeeId} on ${date.toISOString()}`
    );
  }

  // The most recent cycle is the current balance
  const currentBalance = toActiveBalance(balances[0]);

  // If there's a second balance, it's the grace-period (older) balance
  const graceBalance =
    balances.length > 1 ? toActiveBalance(balances[1]) : undefined;

  return { currentBalance, graceBalance };
}

interface ActiveBalance {
  id: string;
  cycleYear: number;
  totalHours: number;
  usedHours: number;
  pendingHours: number;
  remainingHours: number;
  graceDeadline: Date;
}

function toActiveBalance(
  b: {
    id: string;
    cycleYear: number;
    totalHours: number;
    usedHours: number;
    pendingHours: number;
    graceDeadline: Date;
  }
): ActiveBalance {
  return {
    id: b.id,
    cycleYear: b.cycleYear,
    totalHours: b.totalHours,
    usedHours: b.usedHours,
    pendingHours: b.pendingHours,
    remainingHours: b.totalHours - b.usedHours - b.pendingHours,
    graceDeadline: b.graceDeadline,
  };
}

/**
 * Deducts leave hours from an employee's balance.
 * Deducts from grace (old cycle) balance first, then current balance.
 * Uses a Prisma transaction for atomicity.
 */
export async function deductLeave(
  employeeId: string,
  hours: number,
  date: Date
): Promise<{ oldUsed: number; newUsed: number }> {
  const { currentBalance, graceBalance } = await getActiveBalance(
    employeeId,
    date
  );

  let oldUsed = 0;
  let newUsed = 0;
  let remaining = hours;

  // Deduct from grace balance first (if available)
  if (graceBalance && graceBalance.remainingHours > 0) {
    const deductFromGrace = Math.min(remaining, graceBalance.remainingHours);
    oldUsed = deductFromGrace;
    remaining -= deductFromGrace;
  }

  // Deduct remainder from current balance
  if (remaining > 0) {
    if (currentBalance.remainingHours < remaining) {
      throw new Error(
        `Insufficient leave balance. Requested ${hours}h, available ${currentBalance.remainingHours + (graceBalance?.remainingHours ?? 0)}h`
      );
    }
    newUsed = remaining;
  }

  await prisma.$transaction(async (tx) => {
    if (oldUsed > 0 && graceBalance) {
      await tx.leaveBalance.update({
        where: { id: graceBalance.id },
        data: { usedHours: { increment: oldUsed } },
      });
    }
    if (newUsed > 0) {
      await tx.leaveBalance.update({
        where: { id: currentBalance.id },
        data: { usedHours: { increment: newUsed } },
      });
    }
  });

  return { oldUsed, newUsed };
}

/**
 * Restores leave hours to a specific balance (e.g., on cancellation).
 */
export async function restoreLeave(
  employeeId: string,
  hours: number,
  balanceId: string
): Promise<void> {
  await prisma.leaveBalance.update({
    where: { id: balanceId },
    data: { usedHours: { decrement: hours } },
  });
}
