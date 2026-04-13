import { getCurrentUser } from "@/lib/auth-utils";
import { calculateLeaveEnd } from "@/lib/working-hours";
import prisma from "@/lib/prisma";
import { LeaveStatus, Role } from "@/generated/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            departmentId: true,
            managerId: true,
          },
        },
        balance: {
          select: {
            id: true,
            cycleYear: true,
            totalHours: true,
            usedHours: true,
            pendingHours: true,
          },
        },
        history: {
          include: {
            actor: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!leave) {
      return Response.json({ error: "Leave request not found" }, { status: 404 });
    }

    // RBAC check
    if (!canViewLeave(user, leave)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return Response.json(leave);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { workShift: true } },
      },
    });

    if (!leave) {
      return Response.json({ error: "Leave request not found" }, { status: 404 });
    }

    // Only owner can edit
    if (leave.employeeId !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Can only edit DRAFT or PENDING_MANAGER
    if (leave.status !== LeaveStatus.DRAFT && leave.status !== LeaveStatus.PENDING_MANAGER) {
      return Response.json(
        { error: "Can only edit leave requests in DRAFT or PENDING_MANAGER status" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { startDate, startTime, totalHours, reason } = body;

    const oldValues: Record<string, string | number | boolean | null> = {};
    const newValues: Record<string, string | number | boolean | null> = {};
    const updateData: Record<string, unknown> = {};

    // If status was PENDING_MANAGER, reset to DRAFT
    if (leave.status === LeaveStatus.PENDING_MANAGER) {
      oldValues.status = leave.status;
      updateData.status = LeaveStatus.DRAFT;
      newValues.status = LeaveStatus.DRAFT;
      // Clear manager action fields
      updateData.managerAction = null;
      updateData.managerComment = null;
      updateData.managerActionAt = null;
    }

    if (reason !== undefined && reason !== leave.reason) {
      oldValues.reason = leave.reason;
      newValues.reason = reason;
      updateData.reason = reason;
    }

    // If date/time/hours changed, recalculate endDate/endTime
    const newStartDate = startDate ? new Date(startDate) : leave.startDate;
    const newStartTime = startTime || leave.startTime;
    const newTotalHours = totalHours ?? leave.totalHours;

    const datesChanged =
      (startDate && new Date(startDate).toISOString() !== leave.startDate.toISOString()) ||
      (startTime && startTime !== leave.startTime) ||
      (totalHours !== undefined && totalHours !== leave.totalHours);

    if (datesChanged) {
      // Validate totalHours
      if (newTotalHours <= 0 || (newTotalHours * 100) % 25 !== 0) {
        return Response.json(
          { error: "totalHours must be a positive multiple of 0.25" },
          { status: 400 }
        );
      }

      const holidays = await prisma.holiday.findMany({ select: { date: true } });
      const holidayDates = holidays.map((h) => h.date);

      const { endDate, endTime } = calculateLeaveEnd(
        leave.employee.workShift,
        newStartDate,
        newStartTime,
        newTotalHours,
        holidayDates
      );

      if (startDate) {
        oldValues.startDate = leave.startDate.toISOString();
        newValues.startDate = newStartDate.toISOString();
        updateData.startDate = newStartDate;
      }
      if (startTime) {
        oldValues.startTime = leave.startTime;
        newValues.startTime = newStartTime;
        updateData.startTime = newStartTime;
      }
      if (totalHours !== undefined) {
        oldValues.totalHours = leave.totalHours;
        newValues.totalHours = newTotalHours;
        updateData.totalHours = newTotalHours;
      }

      oldValues.endDate = leave.endDate.toISOString();
      oldValues.endTime = leave.endTime;
      newValues.endDate = endDate.toISOString();
      newValues.endTime = endTime;
      updateData.endDate = endDate;
      updateData.endTime = endTime;
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: "No changes provided" }, { status: 400 });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: updateData,
      include: {
        employee: { select: { id: true, name: true, email: true } },
      },
    });

    // Create history entry
    await prisma.leaveRequestHistory.create({
      data: {
        requestId: id,
        action: "EDIT",
        actorId: user.id,
        oldValues: oldValues,
        newValues: newValues,
      },
    });

    return Response.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

function canViewLeave(
  user: { id: string; role: Role; departmentId: string },
  leave: {
    employeeId: string;
    employee: { departmentId: string; managerId: string | null };
  }
): boolean {
  if (user.role === Role.ADMIN) return true;
  if (leave.employeeId === user.id) return true;
  if (user.role === Role.MANAGER && leave.employee.managerId === user.id) return true;
  if (user.role === Role.HEAD && leave.employee.departmentId === user.departmentId) return true;
  return false;
}
