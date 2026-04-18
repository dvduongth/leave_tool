import { getCurrentUser } from "@/lib/auth-utils";
import { restoreLeave } from "@/lib/leave-calculator";
import { createNotification } from "@/lib/notifications";
import prisma from "@/lib/prisma";
import { LeaveStatus, Role } from "@/generated/prisma";

/**
 * Approves an employee's request to cancel an already-APPROVED leave.
 * Transitions CANCEL_PENDING → CANCELLED and restores balance.
 *
 * Permission: employee's manager, department head, or ADMIN.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      user.role !== Role.MANAGER &&
      user.role !== Role.HEAD &&
      user.role !== Role.ADMIN
    ) {
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
            managerId: true,
            departmentId: true,
          },
        },
      },
    });

    if (!leave) {
      return Response.json({ error: "Leave request not found" }, { status: 404 });
    }

    if (leave.status !== LeaveStatus.CANCEL_PENDING) {
      return Response.json(
        { error: `Cannot approve cancel for leave in ${leave.status} status` },
        { status: 400 }
      );
    }

    // Permission: manager / dept head / admin
    const department = await prisma.department.findUnique({
      where: { id: leave.employee.departmentId },
      select: { headId: true },
    });
    const isManager = leave.employee.managerId === user.id;
    const isHead = department?.headId === user.id;
    const isAdmin = user.role === Role.ADMIN;

    if (!isManager && !isHead && !isAdmin) {
      return Response.json(
        { error: "You cannot approve this cancellation" },
        { status: 403 }
      );
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.CANCELLED },
      include: { employee: { select: { id: true, name: true, email: true } } },
    });

    // Restore balance (only NOW, after approval)
    if (leave.balanceId) {
      await restoreLeave(leave.employeeId, leave.totalHours, leave.balanceId);
    }

    await prisma.leaveRequestHistory.create({
      data: {
        requestId: id,
        action: "APPROVE_CANCEL",
        actorId: user.id,
        oldValues: { status: LeaveStatus.CANCEL_PENDING },
        newValues: { status: LeaveStatus.CANCELLED },
      },
    });

    await createNotification(
      leave.employeeId,
      "Leave cancellation approved",
      `Your request to cancel ${leave.totalHours}h of leave has been approved`,
      `/leaves/${id}`
    );

    return Response.json(updated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
