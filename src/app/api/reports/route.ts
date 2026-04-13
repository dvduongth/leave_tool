import { getCurrentUser } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { LeaveStatus, Role } from "@/generated/prisma";

function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function getVisibleEmployeeIds(
  user: { id: string; role: Role; departmentId: string },
  departmentId?: string | null
): Promise<string[] | null> {
  if (user.role === Role.EMPLOYEE) {
    return [user.id];
  }

  if (user.role === Role.MANAGER) {
    const subordinates = await prisma.employee.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    return [user.id, ...subordinates.map((s) => s.id)];
  }

  if (user.role === Role.HEAD) {
    const deptId = departmentId || user.departmentId;
    if (deptId !== user.departmentId) {
      return [];
    }
    const employees = await prisma.employee.findMany({
      where: { departmentId: deptId },
      select: { id: true },
    });
    return employees.map((e) => e.id);
  }

  // ADMIN: filter by department if specified, otherwise null = all
  if (user.role === Role.ADMIN && departmentId) {
    const employees = await prisma.employee.findMany({
      where: { departmentId },
      select: { id: true },
    });
    return employees.map((e) => e.id);
  }

  return null; // null = no filter (ADMIN, all employees)
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "daily";
    const dateStr = searchParams.get("date");
    const departmentId = searchParams.get("departmentId");

    const queryDate = dateStr ? new Date(dateStr) : new Date();
    queryDate.setHours(0, 0, 0, 0);

    const employeeIds = await getVisibleEmployeeIds(
      user,
      departmentId
    );

    const employeeFilter = employeeIds
      ? { employeeId: { in: employeeIds } }
      : {};

    if (type === "daily") {
      return Response.json(
        await getDailyReport(queryDate, employeeFilter)
      );
    }

    if (type === "weekly") {
      return Response.json(
        await getWeeklyReport(queryDate, employeeFilter)
      );
    }

    if (type === "monthly") {
      return Response.json(
        await getMonthlyReport(queryDate, employeeFilter, user.role)
      );
    }

    return Response.json({ error: "Invalid report type" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

async function getDailyReport(
  date: Date,
  employeeFilter: Record<string, unknown>
) {
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      ...employeeFilter,
      status: LeaveStatus.APPROVED,
      startDate: { lte: date },
      endDate: { gte: date },
    },
    include: {
      employee: { select: { id: true, name: true, departmentId: true } },
    },
  });

  const otRecords = await prisma.oTRecord.findMany({
    where: {
      ...employeeFilter,
      date,
      status: "APPROVED",
    },
    include: {
      employee: { select: { id: true, name: true } },
    },
  });

  const totalOtMinutes = otRecords.reduce((s, r) => s + r.otMinutes, 0);

  return {
    type: "daily",
    date: date.toISOString(),
    employees: leaves.map((l) => ({
      id: l.employee.id,
      name: l.employee.name,
      totalHours: l.totalHours,
      status: l.status,
    })),
    otRecords: otRecords.map((r) => ({
      id: r.employee.id,
      name: r.employee.name,
      otMinutes: r.otMinutes,
    })),
    summary: {
      totalOnLeave: leaves.length,
      totalOtMinutes,
    },
  };
}

async function getWeeklyReport(
  date: Date,
  employeeFilter: Record<string, unknown>
) {
  const thisWeek = getWeekBounds(date);
  const prevWeekDate = new Date(thisWeek.start);
  prevWeekDate.setDate(prevWeekDate.getDate() - 7);
  const prevWeek = getWeekBounds(prevWeekDate);

  const [thisLeaves, prevLeaves, thisOt, approvalStats] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        ...employeeFilter,
        status: LeaveStatus.APPROVED,
        startDate: { lte: thisWeek.end },
        endDate: { gte: thisWeek.start },
      },
      include: {
        employee: { select: { id: true, name: true } },
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        ...employeeFilter,
        status: LeaveStatus.APPROVED,
        startDate: { lte: prevWeek.end },
        endDate: { gte: prevWeek.start },
      },
      include: {
        employee: { select: { id: true, name: true } },
      },
    }),
    prisma.oTRecord.findMany({
      where: {
        ...employeeFilter,
        date: { gte: thisWeek.start, lte: thisWeek.end },
        status: "APPROVED",
      },
      include: {
        employee: { select: { id: true, name: true } },
      },
    }),
    prisma.leaveRequest.groupBy({
      by: ["status"],
      where: {
        ...employeeFilter,
        updatedAt: { gte: thisWeek.start, lte: thisWeek.end },
        status: { in: [LeaveStatus.APPROVED, LeaveStatus.REJECTED] },
      },
      _count: { id: true },
    }),
  ]);

  // Aggregate by employee
  const empMap = new Map<
    string,
    {
      id: string;
      name: string;
      thisWeekHours: number;
      prevWeekHours: number;
      otMinutes: number;
    }
  >();

  for (const l of thisLeaves) {
    const key = l.employee.id;
    const entry = empMap.get(key) || {
      id: key,
      name: l.employee.name,
      thisWeekHours: 0,
      prevWeekHours: 0,
      otMinutes: 0,
    };
    entry.thisWeekHours += l.totalHours;
    empMap.set(key, entry);
  }

  for (const l of prevLeaves) {
    const key = l.employee.id;
    const entry = empMap.get(key) || {
      id: key,
      name: l.employee.name,
      thisWeekHours: 0,
      prevWeekHours: 0,
      otMinutes: 0,
    };
    entry.prevWeekHours += l.totalHours;
    empMap.set(key, entry);
  }

  for (const r of thisOt) {
    const key = r.employee.id;
    const entry = empMap.get(key) || {
      id: key,
      name: r.employee.name,
      thisWeekHours: 0,
      prevWeekHours: 0,
      otMinutes: 0,
    };
    entry.otMinutes += r.otMinutes;
    empMap.set(key, entry);
  }

  const employees = Array.from(empMap.values()).map((e) => ({
    ...e,
    delta: e.thisWeekHours - e.prevWeekHours,
  }));

  const approvedCount =
    approvalStats.find((s) => s.status === LeaveStatus.APPROVED)?._count.id ??
    0;
  const rejectedCount =
    approvalStats.find((s) => s.status === LeaveStatus.REJECTED)?._count.id ??
    0;

  // Leave hours by day of week (Mon=0 .. Sun=6)
  const dayOfWeekHours = [0, 0, 0, 0, 0, 0, 0];
  for (const l of thisLeaves) {
    const start = new Date(l.startDate);
    const dow = start.getDay();
    const idx = dow === 0 ? 6 : dow - 1; // Monday=0
    dayOfWeekHours[idx] += l.totalHours;
  }

  const totalOtMinutes = thisOt.reduce((s, r) => s + r.otMinutes, 0);
  const totalLeaveHours = thisLeaves.reduce((s, l) => s + l.totalHours, 0);

  return {
    type: "weekly",
    weekStart: thisWeek.start.toISOString(),
    weekEnd: thisWeek.end.toISOString(),
    employees,
    summary: {
      totalLeaveHours,
      totalOtMinutes,
      approvedCount,
      rejectedCount,
      approvalRate:
        approvedCount + rejectedCount > 0
          ? Math.round(
              (approvedCount / (approvedCount + rejectedCount)) * 100
            )
          : 0,
    },
    dayOfWeekHours: [
      { day: "Mon", hours: dayOfWeekHours[0] },
      { day: "Tue", hours: dayOfWeekHours[1] },
      { day: "Wed", hours: dayOfWeekHours[2] },
      { day: "Thu", hours: dayOfWeekHours[3] },
      { day: "Fri", hours: dayOfWeekHours[4] },
      { day: "Sat", hours: dayOfWeekHours[5] },
      { day: "Sun", hours: dayOfWeekHours[6] },
    ],
  };
}

async function getMonthlyReport(
  date: Date,
  employeeFilter: Record<string, unknown>,
  role: Role
) {
  const month = getMonthBounds(date);
  const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  // Get all departments with employees for grouping
  const departments = await prisma.department.findMany({
    include: {
      employees: {
        where: employeeFilter.employeeId
          ? { id: employeeFilter.employeeId as { in: string[] } }
          : {},
        select: { id: true, name: true },
      },
    },
  });

  const filteredDepts = departments.filter((d) => d.employees.length > 0);

  // Fetch leaves and OT for the month
  const allEmpIds = filteredDepts.flatMap((d) => d.employees.map((e) => e.id));
  const empFilter = employeeFilter.employeeId
    ? employeeFilter
    : { employeeId: { in: allEmpIds } };

  const [leaves, otRecords, flexSummaries] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        ...empFilter,
        status: LeaveStatus.APPROVED,
        startDate: { lte: month.end },
        endDate: { gte: month.start },
      },
      include: {
        employee: {
          select: { id: true, name: true, departmentId: true },
        },
      },
    }),
    prisma.oTRecord.findMany({
      where: {
        ...empFilter,
        date: { gte: month.start, lte: month.end },
        status: "APPROVED",
      },
      include: {
        employee: {
          select: { id: true, departmentId: true },
        },
      },
    }),
    prisma.flexTimeMonthlySummary.findMany({
      where: {
        ...(employeeFilter.employeeId
          ? employeeFilter
          : { employeeId: { in: allEmpIds } }),
        yearMonth,
      },
      include: {
        employee: {
          select: { id: true, departmentId: true },
        },
      },
    }),
  ]);

  // Build per-department summary
  const deptSummaries = filteredDepts.map((dept) => {
    const deptEmpIds = new Set(dept.employees.map((e) => e.id));
    const deptLeaves = leaves.filter((l) => deptEmpIds.has(l.employee.id));
    const deptOt = otRecords.filter((r) => deptEmpIds.has(r.employee.id));
    const deptFlex = flexSummaries.filter((f) =>
      deptEmpIds.has(f.employee.id)
    );

    const totalLeaveHours = deptLeaves.reduce(
      (s, l) => s + l.totalHours,
      0
    );
    const totalOtMinutes = deptOt.reduce((s, r) => s + r.otMinutes, 0);
    const employeeCount = dept.employees.length;

    // Utilization: usedHours / (employeeCount * 96) assuming 96h total per employee
    const utilizationRate =
      employeeCount > 0
        ? Math.round((totalLeaveHours / (employeeCount * 96)) * 100)
        : 0;

    const totalDeficit = deptFlex.reduce((s, f) => s + f.totalDeficit, 0);
    const totalMakeup = deptFlex.reduce((s, f) => s + f.totalMakeup, 0);
    const employeesWithRemaining = deptFlex.filter(
      (f) => f.remaining > 0
    ).length;

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      employeeCount,
      totalLeaveHours,
      totalOtMinutes,
      utilizationRate,
      flex: {
        totalDeficit,
        totalMakeup,
        employeesWithRemaining,
      },
    };
  });

  // Top 5 leave takers
  const empLeaveMap = new Map<
    string,
    { id: string; name: string; hours: number }
  >();
  for (const l of leaves) {
    const entry = empLeaveMap.get(l.employee.id) || {
      id: l.employee.id,
      name: l.employee.name,
      hours: 0,
    };
    entry.hours += l.totalHours;
    empLeaveMap.set(l.employee.id, entry);
  }
  const topLeaveTakers = Array.from(empLeaveMap.values())
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5);

  return {
    type: "monthly",
    monthStart: month.start.toISOString(),
    monthEnd: month.end.toISOString(),
    departments: deptSummaries,
    topLeaveTakers,
  };
}
