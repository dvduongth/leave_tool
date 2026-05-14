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

    const record = await prisma.flexTimeRecord.findUnique({
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
      return Response.json({ error: "Record not found" }, { status: 404 });
    }

    if (record.status !== RecordStatus.CANCEL_PENDING) {
      return Response.json(
        { error: "Record is not pending cancellation" },
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

    // Reverse the MonthlySummary changes
    const recordDate = new Date(record.date);
    const yearMonth = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, "0")}`;

    await prisma.flexTimeMonthlySummary.updateMany({
      where: {
        employeeId: record.employeeId,
        yearMonth,
      },
      data: {
        totalDeficit:
          record.type === "DEFICIT"
            ? { decrement: record.minutes }
            : undefined,
        totalMakeup:
          record.type === "MAKEUP"
            ? { decrement: record.minutes }
            : undefined,
        remaining:
          record.type === "DEFICIT"
            ? { decrement: record.minutes }
            : { increment: record.minutes },
      },
    });

    // Update status to CANCELLED
    const updated = await prisma.flexTimeRecord.update({
      where: { id },
      data: { status: RecordStatus.CANCELLED },
      include: {
        employee: { select: { id: true, name: true } },
      },
    });

    await clearNotificationsForEntity("flex-time", id);

    // Notify employee
    const dateStr = record.date.toISOString().slice(0, 10);
    const typeLabel = record.type === "DEFICIT" ? "thiếu giờ" : "bù giờ";
    await createNotification(
      record.employeeId,
      "Flex time cancellation approved",
      `Yêu cầu huỷ ${typeLabel} ngày ${dateStr} đã được duyệt`,
      `/flex-time`
    );

    return Response.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
