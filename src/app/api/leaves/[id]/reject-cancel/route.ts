import { getCurrentUser } from "@/lib/auth-utils";
import { createNotification } from "@/lib/notifications";
import prisma from "@/lib/prisma";
import { LeaveStatus, Role } from "@/generated/prisma";

/**
 * Rejects an employee's request to cancel an already-APPROVED leave.
 * Transitions CANCEL_PENDING → APPROVED (balance was never restored, so no-op).
 *
 * Permission: employee's manager, department head, or ADMIN.
 */
export async function POST(
  request: Request,
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
    const body = await request.json().catch(() => ({}));
    const comment: string | undefined = body?.comment;

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
        { error: `Cannot reject cancel for leave in ${leave.status} status` },
        { status: 400 }
      );
    }

    const department = await prisma.department.findUnique({
      where: { id: leave.employee.departmentId },
      select: { headId: true },
    });
    const isManager = leave.employee.managerId === user.id;
    const isHead = department?.headId === user.id;
    const isAdmin = user.role === Role.ADMIN;

    if (!isManager && !isHead && !isAdmin) {
      return Response.json(
        { error: "You cannot reject this cancellation" },
        { status: 403 }
      );
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveStatus.APPROVED,
        cancelledAt: null,
      },
      include: { employee: { select: { id: true, name: true, email: true } } },
    });

    await prisma.leaveRequestHistory.create({
      data: {
        requestId: id,
        action: "REJECT_CANCEL",
        actorId: user.id,
        oldValues: { status: LeaveStatus.CANCEL_PENDING },
        newValues: { status: LeaveStatus.APPROVED, comment: comment ?? null },
      },
    });

    await createNotification(
      leave.employeeId,
      "Leave cancellation rejected",
      `Your request to cancel ${leave.totalHours}h of leave was rejected${comment ? `: ${comment}` : ""}. The leave remains approved.`,
      `/leaves/${id}`
    );

    return Response.json(updated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
