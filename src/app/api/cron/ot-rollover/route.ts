import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { computeCycleForDate } from "@/lib/ot-bank";

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const headerSecret = request.headers.get("authorization")?.replace("Bearer ", "");
  const querySecret = request.nextUrl.searchParams.get("secret");
  return headerSecret === secret || querySecret === secret;
}

/**
 * Run on 1/6 yearly (and idempotent — safe to re-run).
 * - Creates an OTBalance row for the new cycle for every active employee.
 * - Cleanup: removes OTBalance rows where graceDeadline < today (cycle is fully expired).
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    const bounds = computeCycleForDate(today);

    const activeEmployees = await prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    let createdCount = 0;
    for (const emp of activeEmployees) {
      const existing = await prisma.oTBalance.findUnique({
        where: {
          employeeId_cycleYear: { employeeId: emp.id, cycleYear: bounds.cycleYear },
        },
      });
      if (!existing) {
        await prisma.oTBalance.create({
          data: {
            employeeId: emp.id,
            cycleYear: bounds.cycleYear,
            cycleStart: bounds.cycleStart,
            cycleEnd: bounds.cycleEnd,
            graceDeadline: bounds.graceDeadline,
            totalMinutes: 0,
            usedMinutes: 0,
            pendingMinutes: 0,
          },
        });
        createdCount++;
      }
    }

    // Cleanup expired balances (graceDeadline before today).
    const expired = await prisma.oTBalance.deleteMany({
      where: { graceDeadline: { lt: today } },
    });

    return Response.json({
      ok: true,
      cycleYear: bounds.cycleYear,
      createdBalances: createdCount,
      expiredBalances: expired.count,
      activeEmployeeCount: activeEmployees.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[ot-rollover] failed:", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
