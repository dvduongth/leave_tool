import { getCurrentUser } from "@/lib/auth-utils";
import { notifyLeaveEventFromRequest } from "@/lib/notifications";
import prisma from "@/lib/prisma";
import { LeaveStatus, Role } from "@/generated/prisma";

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

    // Only owner can submit
    if (leave.employeeId !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Must be in DRAFT status
    if (leave.status !== LeaveStatus.DRAFT) {
      return Response.json(
        { error: "Can only submit leave requests in DRAFT status" },
        { status: 400 }
      );
    }

    // Determine next status based on employee's role
    let nextStatus: LeaveStatus;
    if (leave.employee.role === Role.MANAGER || leave.employee.role === Role.ADMIN) {
      // Managers and Admins skip L1, go directly to PENDING_HEAD
      nextStatus = LeaveStatus.PENDING_HEAD;
    } else {
      nextStatus = LeaveStatus.PENDING_MANAGER;
    }

    // Update leave status
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: nextStatus },
      include: {
        employee: { select: { id: true, name: true, email: true } },
      },
    });

    // Update pending_hours on balance
    if (leave.balanceId) {
      await prisma.leaveBalance.update({
        where: { id: leave.balanceId },
        data: { pendingHours: { increment: leave.totalHours } },
      });
    }

    // Create history entry
    await prisma.leaveRequestHistory.create({
      data: {
        requestId: id,
        action: "SUBMIT",
        actorId: user.id,
        oldValues: { status: LeaveStatus.DRAFT },
        newValues: { status: nextStatus },
      },
    });

    // Notify the approver
    const approverInApp = {
      title: "New leave request pending approval",
      message: `${leave.employee.name} submitted a leave request for ${leave.totalHours}h`,
      link: `/leaves/${id}`,
    };
    if (nextStatus === LeaveStatus.PENDING_MANAGER && leave.employee.managerId) {
      await notifyLeaveEventFromRequest(
        leave.employee.managerId,
        "leave_submitted_to_approver",
        leave,
        approverInApp
      );
    } else if (nextStatus === LeaveStatus.PENDING_HEAD) {
      // Find department head
      const department = await prisma.department.findUnique({
        where: { id: leave.employee.departmentId },
        select: { headId: true },
      });
      if (department?.headId && department.headId !== leave.employeeId) {
        await notifyLeaveEventFromRequest(
          department.headId,
          "leave_submitted_to_approver",
          leave,
          approverInApp
        );
      } else {
        // No head set, OR the submitter is themselves the head/admin.
        // Notify all admins so someone can act on it.
        const admins = await prisma.employee.findMany({
          where: { role: Role.ADMIN, id: { not: leave.employeeId } },
          select: { id: true },
        });
        for (const a of admins) {
          await notifyLeaveEventFromRequest(
            a.id,
            "leave_submitted_to_approver",
            leave,
            approverInApp
          );
        }
      }
    }

    return Response.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
