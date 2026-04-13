import { getCurrentUser } from "@/lib/auth-utils";
import { restoreLeave } from "@/lib/leave-calculator";
import { createNotification } from "@/lib/notifications";
import prisma from "@/lib/prisma";
import { LeaveStatus } from "@/generated/prisma";

export async function POST(
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
            managerId: true,
            departmentId: true,
          },
        },
      },
    });

    if (!leave) {
      return Response.json({ error: "Leave request not found" }, { status: 404 });
    }

    // Only owner can cancel
    if (leave.employeeId !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const oldStatus = leave.status;

    // DRAFT or PENDING_MANAGER: just cancel
    if (
      oldStatus === LeaveStatus.DRAFT ||
      oldStatus === LeaveStatus.PENDING_MANAGER
    ) {
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveStatus.CANCELLED,
          cancelledAt: new Date(),
        },
        include: {
          employee: { select: { id: true, name: true, email: true } },
        },
      });

      // Restore pending_hours if was PENDING_MANAGER
      if (oldStatus === LeaveStatus.PENDING_MANAGER && leave.balanceId) {
        await prisma.leaveBalance.update({
          where: { id: leave.balanceId },
          data: { pendingHours: { decrement: leave.totalHours } },
        });
      }

      await prisma.leaveRequestHistory.create({
        data: {
          requestId: id,
          action: "CANCEL",
          actorId: user.id,
          oldValues: { status: oldStatus },
          newValues: { status: LeaveStatus.CANCELLED },
        },
      });

      return Response.json(updated);
    }

    // PENDING_HEAD: cancel if head hasn't acted
    if (oldStatus === LeaveStatus.PENDING_HEAD) {
      if (leave.headAction) {
        return Response.json(
          { error: "Department head has already acted on this request" },
          { status: 400 }
        );
      }

      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveStatus.CANCELLED,
          cancelledAt: new Date(),
        },
        include: {
          employee: { select: { id: true, name: true, email: true } },
        },
      });

      // Restore pending_hours
      if (leave.balanceId) {
        await prisma.leaveBalance.update({
          where: { id: leave.balanceId },
          data: { pendingHours: { decrement: leave.totalHours } },
        });
      }

      await prisma.leaveRequestHistory.create({
        data: {
          requestId: id,
          action: "CANCEL",
          actorId: user.id,
          oldValues: { status: oldStatus },
          newValues: { status: LeaveStatus.CANCELLED },
        },
      });

      // Notify department head
      const department = await prisma.department.findUnique({
        where: { id: leave.employee.departmentId },
        select: { headId: true },
      });
      if (department?.headId) {
        await createNotification(
          department.headId,
          "Leave request cancelled",
          `${leave.employee.name} cancelled their leave request for ${leave.totalHours}h`,
          `/leaves/${id}`
        );
      }

      return Response.json(updated);
    }

    // APPROVED: set to CANCEL_PENDING (needs re-approval)
    if (oldStatus === LeaveStatus.APPROVED) {
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveStatus.CANCEL_PENDING,
          cancelledAt: new Date(),
        },
        include: {
          employee: { select: { id: true, name: true, email: true } },
        },
      });

      // Restore balance (was already deducted on approval)
      if (leave.balanceId) {
        await restoreLeave(leave.employeeId, leave.totalHours, leave.balanceId);
      }

      await prisma.leaveRequestHistory.create({
        data: {
          requestId: id,
          action: "REQUEST_CANCEL",
          actorId: user.id,
          oldValues: { status: oldStatus },
          newValues: { status: LeaveStatus.CANCEL_PENDING },
        },
      });

      // Notify manager and/or head
      if (leave.employee.managerId) {
        await createNotification(
          leave.employee.managerId,
          "Leave cancellation requested",
          `${leave.employee.name} requested to cancel their approved leave for ${leave.totalHours}h`,
          `/leaves/${id}`
        );
      }

      const department = await prisma.department.findUnique({
        where: { id: leave.employee.departmentId },
        select: { headId: true },
      });
      if (department?.headId) {
        await createNotification(
          department.headId,
          "Leave cancellation requested",
          `${leave.employee.name} requested to cancel their approved leave for ${leave.totalHours}h`,
          `/leaves/${id}`
        );
      }

      return Response.json(updated);
    }

    return Response.json(
      { error: `Cannot cancel leave in ${oldStatus} status` },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
