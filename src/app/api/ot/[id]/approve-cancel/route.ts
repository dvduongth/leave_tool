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

    const record = await prisma.oTRecord.findUnique({
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
        otBalance: true,
      },
    });

    if (!record) {
      return Response.json({ error: "OT record not found" }, { status: 404 });
    }

    if (record.status !== RecordStatus.CANCEL_PENDING) {
      return Response.json(
        { error: "OT record is not pending cancellation" },
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

    // Restore OT balance if it was deducted (remaining is calculated, not stored)
    if (record.otBalanceId && record.otBalance) {
      await prisma.oTBalance.update({
        where: { id: record.otBalanceId },
        data: {
          usedMinutes: { decrement: record.otMinutes },
        },
      });
    }

    // Update status to CANCELLED
    const updated = await prisma.oTRecord.update({
      where: { id },
      data: { status: RecordStatus.CANCELLED },
      include: {
        employee: { select: { id: true, name: true } },
      },
    });

    await clearNotificationsForEntity("ot", id);

    // Notify employee
    const dateStr = record.date.toISOString().slice(0, 10);
    await createNotification(
      record.employeeId,
      "OT cancellation approved",
      `Your OT on ${dateStr} (${record.otMinutes} minutes) has been cancelled`,
      `/ot`
    );

    return Response.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
