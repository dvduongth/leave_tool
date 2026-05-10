import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { createNotification, clearNotificationsForEntity } from "@/lib/notifications";
import { accrueOTBank } from "@/lib/ot-bank";
import { Role } from "@/generated/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (
      user.role !== Role.MANAGER &&
      user.role !== Role.HEAD &&
      user.role !== Role.ADMIN
    ) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const record = await prisma.oTRecord.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, name: true, managerId: true, departmentId: true },
        },
      },
    });
    if (!record) {
      return Response.json({ error: "OT record not found" }, { status: 404 });
    }
    if (record.status !== "PENDING") {
      return Response.json(
        { error: `Cannot approve OT in ${record.status} status` },
        { status: 400 }
      );
    }

    const department = await prisma.department.findUnique({
      where: { id: record.employee.departmentId },
      select: { headId: true },
    });
    const isManager = record.employee.managerId === user.id;
    const isHead = department?.headId === user.id;
    const isAdmin = user.role === Role.ADMIN;

    if (!isManager && !isHead && !isAdmin) {
      return Response.json(
        { error: "You cannot approve this OT record" },
        { status: 403 }
      );
    }

    // Bug 4 fix: atomic status guard so concurrent approve+reject can't both win.
    const guard = await prisma.oTRecord.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "APPROVED" },
    });
    if (guard.count === 0) {
      return Response.json(
        { error: "OT record was already processed" },
        { status: 409 }
      );
    }
    const updated = await prisma.$transaction(async (tx) => {
      await accrueOTBank(tx, id, record.employeeId, record.date, record.otMinutes);
      return tx.oTRecord.findUniqueOrThrow({ where: { id } });
    });

    // Bug 7 fix: clear approver-side pending notifications now that it's APPROVED
    await clearNotificationsForEntity("ot", id);

    await createNotification(
      record.employeeId,
      "OT approved",
      `Your OT on ${record.date.toISOString().slice(0, 10)} (${record.otMinutes} minutes) has been approved`,
      `/ot`
    );

    return Response.json(updated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
