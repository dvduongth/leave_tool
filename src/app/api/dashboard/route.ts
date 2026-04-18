import { getCurrentUser } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { LeaveStatus, Role, FlexMonthStatus } from "@/generated/prisma";
import {
  LOW_BALANCE_THRESHOLD_HOURS,
  HIGH_OT_THRESHOLD_HOURS,
} from "@/lib/constants";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    // --- Balance ---
    const balances = await prisma.leaveBalance.findMany({
      where: {
        employeeId: user.id,
        OR: [
          { cycleStart: { lte: today }, cycleEnd: { gte: today } },
          { cycleEnd: { lt: today }, graceDeadline: { gte: today } },
        ],
      },
      orderBy: { cycleYear: "desc" },
    });

    const currentBal = balances[0] ?? null;
    const graceBal = balances.length > 1 ? balances[1] : null;

    const balance = currentBal
      ? {
          totalHours: currentBal.totalHours,
          usedHours: currentBal.usedHours,
          pendingHours: currentBal.pendingHours,
          remainingHours:
            currentBal.totalHours -
            currentBal.usedHours -
            currentBal.pendingHours,
          graceBalance: graceBal
            ? {
                totalHours: graceBal.totalHours,
                usedHours: graceBal.usedHours,
                remainingHours:
                  graceBal.totalHours -
                  graceBal.usedHours -
                  graceBal.pendingHours,
                graceDeadline: graceBal.graceDeadline,
              }
            : null,
        }
      : null;

    // --- Flex Time Status (current month) ---
    const flexSummary = await prisma.flexTimeMonthlySummary.findUnique({
      where: {
        employeeId_yearMonth: { employeeId: user.id, yearMonth },
      },
    });

    const flexTime = flexSummary
      ? {
          totalDeficit: flexSummary.totalDeficit,
          totalMakeup: flexSummary.totalMakeup,
          remaining: flexSummary.remaining,
          status: flexSummary.status,
          yearMonth,
        }
      : {
          totalDeficit: 0,
          totalMakeup: 0,
          remaining: 0,
          status: FlexMonthStatus.OPEN,
          yearMonth,
        };

    // --- Recent Leaves (last 5) ---
    const recentLeaves = await prisma.leaveRequest.findMany({
      where: { employeeId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        totalHours: true,
        status: true,
        reason: true,
        createdAt: true,
      },
    });

    // --- OT this month ---
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const otRecords = await prisma.oTRecord.findMany({
      where: {
        employeeId: user.id,
        date: { gte: monthStart, lte: monthEnd },
        status: "APPROVED",
      },
      select: { otMinutes: true },
    });
    const totalOtMinutes = otRecords.reduce((s, r) => s + r.otMinutes, 0);

    // --- Alerts ---
    const alerts: { type: string; message: string }[] = [];

    if (balance && balance.remainingHours < LOW_BALANCE_THRESHOLD_HOURS) {
      alerts.push({
        type: "low_balance",
        message: `Low leave balance: ${balance.remainingHours}h remaining`,
      });
    }

    if (flexTime.remaining > 0 && flexTime.status === FlexMonthStatus.OPEN) {
      alerts.push({
        type: "flex_deficit",
        message: `Uncompensated flex deficit: ${flexTime.remaining} minutes this month`,
      });
    }

    if (totalOtMinutes > HIGH_OT_THRESHOLD_HOURS * 60) {
      alerts.push({
        type: "high_ot",
        message: `High OT this month: ${Math.round(totalOtMinutes / 60)}h (>${HIGH_OT_THRESHOLD_HOURS}h threshold)`,
      });
    }

    // --- Role-specific data ---
    let pendingCount = 0;
    let todayAbsences: { id: string; name: string; totalHours: number }[] = [];
    let teamOrDeptSize = 0;
    let totalEmployees: number | undefined;

    if (user.role === Role.MANAGER) {
      const subordinates = await prisma.employee.findMany({
        where: { managerId: user.id },
        select: { id: true, name: true },
      });
      const subIds = subordinates.map((s) => s.id);
      teamOrDeptSize = subordinates.length;

      pendingCount = await prisma.leaveRequest.count({
        where: {
          employeeId: { in: subIds },
          status: LeaveStatus.PENDING_MANAGER,
        },
      });

      const absences = await prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: subIds },
          status: LeaveStatus.APPROVED,
          startDate: { lte: today },
          endDate: { gte: today },
        },
        include: {
          employee: { select: { id: true, name: true } },
        },
      });
      todayAbsences = absences.map((a) => ({
        id: a.employee.id,
        name: a.employee.name,
        totalHours: a.totalHours,
      }));
    } else if (user.role === Role.HEAD) {
      const deptEmployees = await prisma.employee.findMany({
        where: { departmentId: user.departmentId },
        select: { id: true, name: true },
      });
      const deptIds = deptEmployees.map((e) => e.id);
      teamOrDeptSize = deptEmployees.length;

      pendingCount = await prisma.leaveRequest.count({
        where: {
          employeeId: { in: deptIds },
          status: LeaveStatus.PENDING_HEAD,
        },
      });

      const absences = await prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: deptIds },
          status: LeaveStatus.APPROVED,
          startDate: { lte: today },
          endDate: { gte: today },
        },
        include: {
          employee: { select: { id: true, name: true } },
        },
      });
      todayAbsences = absences.map((a) => ({
        id: a.employee.id,
        name: a.employee.name,
        totalHours: a.totalHours,
      }));
    } else if (user.role === Role.ADMIN) {
      totalEmployees = await prisma.employee.count();

      pendingCount = await prisma.leaveRequest.count({
        where: {
          status: {
            in: [LeaveStatus.PENDING_MANAGER, LeaveStatus.PENDING_HEAD],
          },
        },
      });

      const absences = await prisma.leaveRequest.findMany({
        where: {
          status: LeaveStatus.APPROVED,
          startDate: { lte: today },
          endDate: { gte: today },
        },
        include: {
          employee: { select: { id: true, name: true } },
        },
      });
      todayAbsences = absences.map((a) => ({
        id: a.employee.id,
        name: a.employee.name,
        totalHours: a.totalHours,
      }));
    }

    return Response.json({
      balance,
      flexTime,
      recentLeaves,
      pendingCount,
      todayAbsences,
      teamOrDeptSize,
      totalEmployees: totalEmployees ?? null,
      alerts,
      role: user.role,
      userName: user.name,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
