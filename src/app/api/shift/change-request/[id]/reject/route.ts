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

    const req = await prisma.shiftChangeRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, name: true, managerId: true, departmentId: true },
        },
      },
    });
    if (!req) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }
    if (req.status !== "PENDING") {
      return Response.json(
        { error: `Cannot reject in ${req.status} status` },
        { status: 400 }
      );
    }

    const isManager = req.employee.managerId === user.id;
    const isAdmin = user.role === Role.ADMIN;
    if (!isManager && !isAdmin) {
      return Response.json(
        { error: "You cannot reject this request" },
        { status: 403 }
      );
    }

    await prisma.shiftChangeRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedBy: user.id,
        approvedAt: new Date(),
        managerComment: comment || null,
      },
    });

    await createNotification(
      req.employeeId,
      "Yêu cầu đổi ca đã bị từ chối",
      `Yêu cầu đổi ca của bạn đã bị từ chối${comment ? `: ${comment}` : ""}`,
      `/shift`
    );

    await logAudit({
      userId: user.id,
      action: "SHIFT_CHANGE_REJECT",
      entity: "shift_change_request",
      entityId: id,
      metadata: {
        targetEmployee: req.employee.name,
        comment: comment || null,
      },
      ipAddress: getRequestIp(request),
    });

    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "Unauthorized") {
      return Response.json({ error: message }, { status: 401 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
