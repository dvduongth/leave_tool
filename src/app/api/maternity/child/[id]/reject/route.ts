import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { createNotification } from "@/lib/notifications";
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

    const child = await prisma.employeeChild.findUnique({
      where: { id },
      include: { employee: { select: { id: true, name: true, managerId: true } } },
    });
    if (!child) return Response.json({ error: "Not found" }, { status: 404 });
    if (child.status !== "PENDING") {
      return Response.json({ error: `Cannot reject in ${child.status} status` }, { status: 400 });
    }

    const isManager = child.employee.managerId === user.id;
    const isAdmin = user.role === Role.ADMIN;
    if (!isManager && !isAdmin) {
      return Response.json({ error: "You cannot reject this declaration" }, { status: 403 });
    }

    await prisma.employeeChild.update({
      where: { id },
      data: { status: "REJECTED", approvedBy: user.id, approvedAt: new Date(), note: comment || child.note },
    });

    await createNotification(
      child.employeeId,
      "Khai báo con bị từ chối",
      `Khai báo con của bạn đã bị từ chối${comment ? `: ${comment}` : ""}`,
      `/maternity`
    );

    await logAudit({
      userId: user.id,
      action: "CHILD_DECLARE_REJECT",
      entity: "employee_child",
      entityId: id,
      metadata: { targetEmployee: child.employee.name, comment: comment || null },
      ipAddress: getRequestIp(request),
    });

    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "Unauthorized") return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
