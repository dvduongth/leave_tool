import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const record = await prisma.menstrualLeave.findUnique({ where: { id } });
    if (!record) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (record.employeeId !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only allow delete if record is today or future (can't revise past)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (record.date < today) {
      return Response.json(
        { error: "Cannot delete a past record" },
        { status: 400 }
      );
    }

    await prisma.menstrualLeave.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
