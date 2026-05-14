import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { createNotification, clearNotificationsForEntity } from "@/lib/notifications";
import { RecordStatus, Role } from "@/generated/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";

    const record = await prisma.shiftChangeRequest.findUnique({
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

    if (!record) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }

    if (record.status !== RecordStatus.CANCEL_PENDING) {
      return Response.json(
        { error: "Request is not pending cancellation" },
        { status: 400 }
      );
    }

    // Check permission: manager, head, or admin
    const isManager = record.employee.managerId === user.id;
    const department = await prisma.department.findUnique({
      where: { id: record.employee.departmentId },
      select: { headId: true },
    });
    const isHead = department?.headId === user.id;
    const isAdmin = user.role === Role.ADMIN;

    if (!isManager && !isHead && !isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Restore status to APPROVED (cancel request rejected)
    const updated = await prisma.shiftChangeRequest.update({
      where: { id },
      data: { status: RecordStatus.APPROVED },
      include: {
        employee: { select: { id: true, name: true } },
      },
    });

    await clearNotificationsForEntity("shift", id);

    // Notify employee
    const dateStr = record.effectiveDate.toISOString().slice(0, 10);
    await createNotification(
      record.employeeId,
      "Shift change cancellation rejected",
      `Yêu cầu huỷ đổi ca hiệu lực từ ${dateStr} bị từ chối${comment ? `: ${comment}` : ""}`,
      `/shift`
    );

    return Response.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
