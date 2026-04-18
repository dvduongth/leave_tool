import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { enabled } = await request.json();
    if (typeof enabled !== "boolean") {
      return Response.json(
        { error: "enabled must be boolean" },
        { status: 400 }
      );
    }
    await prisma.employee.update({
      where: { id: user.id },
      data: { emailNotifEnabled: enabled },
    });
    return Response.json({ ok: true, enabled });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const row = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { emailNotifEnabled: true, email: true },
    });
    return Response.json({
      enabled: row?.emailNotifEnabled ?? true,
      email: row?.email ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
