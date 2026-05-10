import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { createNotification, clearNotificationsForEntity } from "@/lib/notifications";
import { logAudit, getRequestIp } from "@/lib/audit";
import { Role } from "@/generated/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const comment: string | undefined = body?.comment;

    if (user.role !== Role.MANAGER && user.role !== Role.HEAD && user.role !== Role.ADMIN) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const rec = await prisma.maternityLeave.findUnique({
      where: { id },
      include: { employee: { select: { id: true, name: true, managerId: true } } },
    });
    if (!rec) return Response.json({ error: "Not found" }, { status: 404 });
    if (rec.status !== "PENDING") {
      return Response.json({ error: `Cannot reject in ${rec.status} status` }, { status: 400 });
    }

    const isManager = rec.employee.managerId === user.id;
    const isAdmin = user.role === Role.ADMIN;
    if (!isManager && !isAdmin) {
      return Response.json({ error: "You cannot reject this record" }, { status: 403 });
    }

    const guard = await prisma.maternityLeave.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: "REJECTED",
        approvedBy: user.id,
        approvedAt: new Date(),
        note: comment || rec.note,
      },
    });
    if (guard.count === 0) {
      return Response.json(
        { error: "Record was already processed" },
        { status: 409 }
      );
    }

    await clearNotificationsForEntity("maternity", id);

    await createNotification(
      rec.employeeId,
      "Đăng ký nghỉ thai sản bị từ chối",
      `Đăng ký ngày ${rec.date.toISOString().slice(0, 10)} đã bị từ chối${comment ? `: ${comment}` : ""}`,
      `/maternity`
    );

    await logAudit({
      userId: user.id,
      action: "MATERNITY_LEAVE_REJECT",
      entity: "maternity_leave",
      entityId: id,
      metadata: { date: rec.date.toISOString().slice(0, 10), comment: comment || null },
      ipAddress: getRequestIp(request),
    });

    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "Unauthorized") return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
