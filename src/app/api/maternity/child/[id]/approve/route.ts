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

    if (user.role !== Role.MANAGER && user.role !== Role.HEAD && user.role !== Role.ADMIN) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const child = await prisma.employeeChild.findUnique({
      where: { id },
      include: { employee: { select: { id: true, name: true, managerId: true } } },
    });
    if (!child) return Response.json({ error: "Not found" }, { status: 404 });
    if (child.status !== "PENDING") {
      return Response.json({ error: `Cannot approve in ${child.status} status` }, { status: 400 });
    }

    const isManager = child.employee.managerId === user.id;
    const isAdmin = user.role === Role.ADMIN;
    if (!isManager && !isAdmin) {
      return Response.json({ error: "You cannot approve this declaration" }, { status: 403 });
    }

    // Bug 4 fix: atomic guard
    const guard = await prisma.employeeChild.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "APPROVED", approvedBy: user.id, approvedAt: new Date() },
    });
    if (guard.count === 0) {
      return Response.json(
        { error: "Declaration was already processed" },
        { status: 409 }
      );
    }

    // Bug 7 fix: clear approver-side notifications
    await clearNotificationsForEntity("child", id);

    await createNotification(
      child.employeeId,
      "Khai báo con đã được duyệt",
      "Khai báo con của bạn đã được duyệt — bạn có thể bắt đầu đăng ký chế độ thai sản",
      `/maternity`
    );

    await logAudit({
      userId: user.id,
      action: "CHILD_DECLARE_APPROVE",
      entity: "employee_child",
      entityId: id,
      metadata: { targetEmployee: child.employee.name, birthDate: child.birthDate.toISOString().slice(0, 10) },
      ipAddress: getRequestIp(request),
    });

    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "Unauthorized") return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
