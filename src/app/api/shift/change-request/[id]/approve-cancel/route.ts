import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { createNotification, clearNotificationsForEntity } from "@/lib/notifications";
import { RecordStatus, Role } from "@/generated/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

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

    // Update status to CANCELLED
    // Note: This does NOT revert the schedule change. If reversal is needed,
    // the employee should submit a new shift change request.
    const updated = await prisma.shiftChangeRequest.update({
      where: { id },
      data: { status: RecordStatus.CANCELLED },
      include: {
        employee: { select: { id: true, name: true } },
      },
    });

    await clearNotificationsForEntity("shift", id);

    // Notify employee
    const dateStr = record.effectiveDate.toISOString().slice(0, 10);
    await createNotification(
      record.employeeId,
      "Shift change cancellation approved",
      `Yêu cầu huỷ đổi ca hiệu lực từ ${dateStr} đã được duyệt. Lưu ý: Ca làm đã áp dụng vẫn giữ nguyên.`,
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
