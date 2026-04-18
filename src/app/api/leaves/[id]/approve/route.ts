import { getCurrentUser } from "@/lib/auth-utils";
import { deductLeave } from "@/lib/leave-calculator";
import { notifyLeaveEventFromRequest } from "@/lib/notifications";
import prisma from "@/lib/prisma";
import { ApprovalAction, LeaveStatus, Role } from "@/generated/prisma";

export async function POST(
  _request: Request,
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

    const { id } = await params;

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            role: true,
            managerId: true,
            departmentId: true,
          },
        },
      },
    });

    if (!leave) {
      return Response.json({ error: "Leave request not found" }, { status: 404 });
    }

    // L1 approval: PENDING_MANAGER and user is employee's manager
    if (leave.status === LeaveStatus.PENDING_MANAGER) {
      if (leave.employee.managerId !== user.id) {
        return Response.json(
          { error: "You are not this employee's manager" },
          { status: 403 }
        );
      }

      // Check if leave owner is HEAD -> auto-approve L2
      if (leave.employee.role === Role.HEAD) {
        const updated = await prisma.leaveRequest.update({
          where: { id },
          data: {
            managerAction: ApprovalAction.APPROVED,
            managerActionAt: new Date(),
            headAction: ApprovalAction.AUTO_APPROVED,
            headActionAt: new Date(),
            status: LeaveStatus.APPROVED,
          },
          include: {
            employee: { select: { id: true, name: true, email: true } },
          },
        });

        // Deduct from leave balance
        if (leave.balanceId) {
          await deductLeave(leave.employeeId, leave.totalHours, leave.startDate);
          // Reduce pending_hours
          await prisma.leaveBalance.update({
            where: { id: leave.balanceId },
            data: { pendingHours: { decrement: leave.totalHours } },
          });
        }

        // Create history entries
        await prisma.leaveRequestHistory.createMany({
          data: [
            {
              requestId: id,
              action: "APPROVE",
              actorId: user.id,
              oldValues: { status: LeaveStatus.PENDING_MANAGER },
              newValues: {
                status: LeaveStatus.APPROVED,
                managerAction: ApprovalAction.APPROVED,
              },
            },
            {
              requestId: id,
              action: "AUTO_APPROVE",
              actorId: user.id,
              oldValues: {},
              newValues: {
                headAction: ApprovalAction.AUTO_APPROVED,
              },
            },
          ],
        });

        // Notify employee
        await notifyLeaveEventFromRequest(
          leave.employeeId,
          "leave_approved",
          leave,
          {
            title: "Leave request approved",
            message: `Your leave request for ${leave.totalHours}h has been approved`,
            link: `/leaves/${id}`,
          }
        );

        return Response.json(updated);
      }

      // Normal L1: move to PENDING_HEAD
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          managerAction: ApprovalAction.APPROVED,
          managerActionAt: new Date(),
          status: LeaveStatus.PENDING_HEAD,
        },
        include: {
          employee: { select: { id: true, name: true, email: true } },
        },
      });

      // Create history entry
      await prisma.leaveRequestHistory.create({
        data: {
          requestId: id,
          action: "APPROVE",
          actorId: user.id,
          oldValues: { status: LeaveStatus.PENDING_MANAGER },
          newValues: {
            status: LeaveStatus.PENDING_HEAD,
            managerAction: ApprovalAction.APPROVED,
          },
        },
      });

      // Notify department head
      const department = await prisma.department.findUnique({
        where: { id: leave.employee.departmentId },
        select: { headId: true },
      });
      if (department?.headId) {
        await notifyLeaveEventFromRequest(
          department.headId,
          "leave_submitted_to_approver",
          leave,
          {
            title: "Leave request pending your approval",
            message: `${leave.employee.name}'s leave request for ${leave.totalHours}h was approved by manager and needs your approval`,
            link: `/leaves/${id}`,
          }
        );
      }

      return Response.json(updated);
    }

    // L2 approval: PENDING_HEAD and user is department head
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
          headAction: ApprovalAction.APPROVED,
          headActionAt: new Date(),
          status: LeaveStatus.APPROVED,
        },
        include: {
          employee: { select: { id: true, name: true, email: true } },
        },
      });

      // Deduct from leave balance
      if (leave.balanceId) {
        await deductLeave(leave.employeeId, leave.totalHours, leave.startDate);
        // Reduce pending_hours
        await prisma.leaveBalance.update({
          where: { id: leave.balanceId },
          data: { pendingHours: { decrement: leave.totalHours } },
        });
      }

      // Create history entry
      await prisma.leaveRequestHistory.create({
        data: {
          requestId: id,
          action: "APPROVE",
          actorId: user.id,
          oldValues: { status: LeaveStatus.PENDING_HEAD },
          newValues: {
            status: LeaveStatus.APPROVED,
            headAction: ApprovalAction.APPROVED,
          },
        },
      });

      // Notify employee
      await notifyLeaveEventFromRequest(
        leave.employeeId,
        "leave_approved",
        leave,
        {
          title: "Leave request approved",
          message: `Your leave request for ${leave.totalHours}h has been fully approved`,
          link: `/leaves/${id}`,
        }
      );

      return Response.json(updated);
    }

    return Response.json(
      { error: `Cannot approve leave in ${leave.status} status` },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
