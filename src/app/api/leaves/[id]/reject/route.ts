import { getCurrentUser } from "@/lib/auth-utils";
import { createNotification } from "@/lib/notifications";
import prisma from "@/lib/prisma";
import { ApprovalAction, LeaveStatus, Role } from "@/generated/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Must be MANAGER or HEAD
    if (user.role !== Role.MANAGER && user.role !== Role.HEAD && user.role !== Role.ADMIN) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { comment } = body;

    if (!comment || typeof comment !== "string" || comment.trim().length === 0) {
      return Response.json(
        { error: "A comment is required when rejecting a leave request" },
        { status: 400 }
      );
    }

    const { id } = await params;

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            managerId: true,
            departmentId: true,
          },
        },
      },
    });

    if (!leave) {
      return Response.json({ error: "Leave request not found" }, { status: 404 });
    }

    if (leave.status === LeaveStatus.PENDING_MANAGER) {
      // Verify user is employee's manager
      if (leave.employee.managerId !== user.id) {
        return Response.json(
          { error: "You are not this employee's manager" },
          { status: 403 }
        );
      }

      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          managerAction: ApprovalAction.REJECTED,
          managerComment: comment.trim(),
          managerActionAt: new Date(),
          status: LeaveStatus.REJECTED,
        },
        include: {
          employee: { select: { id: true, name: true, email: true } },
        },
      });

      // Restore pending_hours on balance
      if (leave.balanceId) {
        await prisma.leaveBalance.update({
          where: { id: leave.balanceId },
          data: { pendingHours: { decrement: leave.totalHours } },
        });
      }

      // Create history entry
      await prisma.leaveRequestHistory.create({
        data: {
          requestId: id,
          action: "REJECT",
          actorId: user.id,
          oldValues: { status: LeaveStatus.PENDING_MANAGER },
          newValues: {
            status: LeaveStatus.REJECTED,
            managerAction: ApprovalAction.REJECTED,
            managerComment: comment.trim(),
          },
        },
      });

      // Notify employee
      await createNotification(
        leave.employeeId,
        "Leave request rejected",
        `Your leave request for ${leave.totalHours}h was rejected by your manager: "${comment.trim()}"`,
        `/leaves/${id}`
      );

      return Response.json(updated);
    }

    if (leave.status === LeaveStatus.PENDING_HEAD) {
      // Verify user is department head
      const department = await prisma.department.findFirst({
        where: {
          id: leave.employee.departmentId,
          headId: user.id,
        },
      });

      if (!department && user.role !== Role.ADMIN) {
        return Response.json(
          { error: "You are not the department head for this employee" },
          { status: 403 }
        );
      }

      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          headAction: ApprovalAction.REJECTED,
          headComment: comment.trim(),
          headActionAt: new Date(),
          status: LeaveStatus.REJECTED,
        },
        include: {
          employee: { select: { id: true, name: true, email: true } },
        },
      });

      // Restore pending_hours on balance
      if (leave.balanceId) {
        await prisma.leaveBalance.update({
          where: { id: leave.balanceId },
          data: { pendingHours: { decrement: leave.totalHours } },
        });
      }

      // Create history entry
      await prisma.leaveRequestHistory.create({
        data: {
          requestId: id,
          action: "REJECT",
          actorId: user.id,
          oldValues: { status: LeaveStatus.PENDING_HEAD },
          newValues: {
            status: LeaveStatus.REJECTED,
            headAction: ApprovalAction.REJECTED,
            headComment: comment.trim(),
          },
        },
      });

      // Notify employee
      await createNotification(
        leave.employeeId,
        "Leave request rejected",
        `Your leave request for ${leave.totalHours}h was rejected by department head: "${comment.trim()}"`,
        `/leaves/${id}`
      );

      return Response.json(updated);
    }

    return Response.json(
      { error: `Cannot reject leave in ${leave.status} status` },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
