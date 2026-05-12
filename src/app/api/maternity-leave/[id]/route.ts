import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { clearNotificationsForEntity } from "@/lib/notifications";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const record = await prisma.maternityLeave.findUnique({ where: { id } });
    if (!record) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (record.employeeId !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (record.status !== "PENDING") {
      return Response.json(
        { error: "Chỉ có thể huỷ khi yêu cầu còn ở trạng thái chờ duyệt" },
        { status: 400 }
      );
    }

    await prisma.maternityLeave.delete({ where: { id } });
    await clearNotificationsForEntity("maternity", id);
    return Response.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
