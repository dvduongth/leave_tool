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
      },
    });

    if (!record) {
      return Response.json({ error: "OT record not found" }, { status: 404 });
    }

    if (record.employeeId !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const oldStatus = record.status;

    // PENDING: just delete (existing behavior)
    if (oldStatus === RecordStatus.PENDING) {
      await prisma.oTRecord.delete({ where: { id } });
      await clearNotificationsForEntity("ot", id);
      return Response.json({ ok: true, action: "deleted" });
    }

    // APPROVED: set to CANCEL_PENDING (needs approver to confirm)
    if (oldStatus === RecordStatus.APPROVED) {
      const updated = await prisma.oTRecord.update({
        where: { id },
        data: { status: RecordStatus.CANCEL_PENDING },
        include: {
          employee: { select: { id: true, name: true } },
        },
      });

      // Notify approvers: manager, head, or admins
      const notified = new Set<string>();
      const notify = async (recipientId: string, message: string) => {
        if (recipientId === record.employeeId || notified.has(recipientId)) return;
        notified.add(recipientId);
        await createNotification(
          recipientId,
          "OT cancellation requested",
          message,
          `/ot`
        );
      };

      const dateStr = record.date.toISOString().slice(0, 10);
      const message = `${record.employee.name} requested to cancel their approved OT on ${dateStr} (${record.otMinutes} minutes)`;

      if (record.employee.managerId) {
        await notify(record.employee.managerId, message);
      }

      const department = await prisma.department.findUnique({
        where: { id: record.employee.departmentId },
        select: { headId: true },
      });
      if (department?.headId) {
        await notify(department.headId, message);
      }

      // If no manager or head, notify admins
      if (!record.employee.managerId && !department?.headId) {
        const admins = await prisma.employee.findMany({
          where: { role: Role.ADMIN, id: { not: record.employeeId } },
          select: { id: true },
        });
        for (const a of admins) await notify(a.id, message);
      }

      return Response.json(updated);
    }

    return Response.json(
      { error: `Cannot cancel OT in ${oldStatus} status` },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
