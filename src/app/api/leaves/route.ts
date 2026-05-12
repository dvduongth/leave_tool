import { EMPLOYEE_REMOVED, getCurrentUser, requireValidEmployee } from "@/lib/auth-utils";
import { getActiveBalance } from "@/lib/leave-calculator";
import { calculateHoursFromRange } from "@/lib/working-hours";
import prisma from "@/lib/prisma";
import { LeaveStatus, Role } from "@/generated/prisma";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as LeaveStatus | null;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const employeeId = searchParams.get("employeeId");

    // Build where clause based on role
    const where: Record<string, unknown> = {};

    if (user.role === Role.EMPLOYEE) {
      where.employeeId = user.id;
    } else if (user.role === Role.MANAGER) {
      if (employeeId) {
        // Manager can view own or direct reports
        if (employeeId !== user.id) {
          const emp = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { managerId: true },
          });
          if (!emp || emp.managerId !== user.id) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }
        }
        where.employeeId = employeeId;
      } else {
        // Show own + direct reports
        const subordinates = await prisma.employee.findMany({
          where: { managerId: user.id },
          select: { id: true },
        });
        const ids = [user.id, ...subordinates.map((s) => s.id)];
        where.employeeId = { in: ids };
      }
    } else if (user.role === Role.HEAD) {
      if (employeeId) {
        if (employeeId !== user.id) {
          const emp = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { departmentId: true },
          });
          if (!emp || emp.departmentId !== user.departmentId) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }
        }
        where.employeeId = employeeId;
      } else {
        // Show own + department
        const deptEmployees = await prisma.employee.findMany({
          where: { departmentId: user.departmentId },
          select: { id: true },
        });
        where.employeeId = { in: deptEmployees.map((e) => e.id) };
      }
    }
    // ADMIN: default to own leaves; explicit employeeId lets them view anyone.
    else if (user.role === Role.ADMIN) {
      where.employeeId = employeeId || user.id;
    }

    if (status) {
      where.status = status;
    }
    if (startDate) {
      where.startDate = { ...(where.startDate as object || {}), gte: new Date(startDate) };
    }
    if (endDate) {
      where.endDate = { ...(where.endDate as object || {}), lte: new Date(endDate) };
    }

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, email: true, role: true, departmentId: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(leaves);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireValidEmployee();

    const body = await request.json();
    const { startDate, startTime, endDate: endDateInput, endTime: endTimeInput, reason } = body;

    if (!startDate || !startTime || !endDateInput || !endTimeInput) {
      return Response.json(
        { error: "startDate, startTime, endDate, endTime are required" },
        { status: 400 }
      );
    }

    const tre = /^\d{2}:\d{2}$/;
    if (!tre.test(startTime) || !tre.test(endTimeInput)) {
      return Response.json(
        { error: "startTime and endTime must be in HH:MM format" },
        { status: 400 }
      );
    }

    // Validate startDate >= today
    const start = new Date(startDate);
    const endDateParsed = new Date(endDateInput);
    if (isNaN(start.getTime()) || isNaN(endDateParsed.getTime())) {
      return Response.json({ error: "Invalid date" }, { status: 400 });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      return Response.json(
        { error: "startDate must be today or in the future" },
        { status: 400 }
      );
    }

    // Get holidays
    const holidays = await prisma.holiday.findMany({
      select: { date: true },
    });
    const holidayDates = holidays.map((h) => h.date);

    // Compute totalHours from the requested range (rounded to 0.25h server-side)
    let computed;
    try {
      computed = await calculateHoursFromRange(
        user.id,
        start,
        startTime,
        endDateParsed,
        endTimeInput,
        holidayDates
      );
    } catch (err) {
      const m = err instanceof Error ? err.message : "Invalid range";
      return Response.json({ error: m }, { status: 400 });
    }

    const totalHours = computed.totalHours;
    const endDate = endDateParsed;
    const endTime = endTimeInput;

    if (totalHours <= 0) {
      return Response.json(
        { error: "Range produces 0 working hours (all weekend/holiday)" },
        { status: 400 }
      );
    }

    // Check sufficient balance
    const { currentBalance, graceBalance } = await getActiveBalance(user.id, start);
    const availableHours =
      currentBalance.remainingHours + (graceBalance?.remainingHours ?? 0);
    if (totalHours > availableHours) {
      return Response.json(
        {
          error: `Insufficient balance. Requested ${totalHours}h, available ${availableHours}h`,
        },
        { status: 400 }
      );
    }

    // Find or create LeaveBalance for current cycle
    const balance = currentBalance;

    // Create leave request as DRAFT
    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId: user.id,
        balanceId: balance.id,
        startDate: start,
        startTime,
        endDate,
        endTime,
        totalHours,
        reason: reason || null,
        status: LeaveStatus.DRAFT,
      },
      include: {
        employee: { select: { id: true, name: true, email: true } },
      },
    });

    // Create history entry
    await prisma.leaveRequestHistory.create({
      data: {
        requestId: leave.id,
        action: "CREATE",
        actorId: user.id,
        newValues: {
          startDate: start.toISOString(),
          startTime,
          endDate: endDate.toISOString(),
          endTime,
          totalHours,
          reason: reason || null,
        },
      },
    });

    return Response.json(leave, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return Response.json({ error: message }, { status: 401 });
    }
    if (message === EMPLOYEE_REMOVED) {
      return Response.json(
        { error: "Tài khoản không còn tồn tại. Vui lòng đăng nhập lại.", code: EMPLOYEE_REMOVED, forceLogout: true },
        { status: 401 }
      );
    }
    if (message.includes("No active leave balance")) {
      return Response.json({ error: message }, { status: 404 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
