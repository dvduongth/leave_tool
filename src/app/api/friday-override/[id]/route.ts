import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN", "HEAD");
    const { id } = await params;

    const existing = await prisma.fridayOverride.findUnique({
      where: { id },
    });

    if (!existing) {
      return Response.json(
        { error: "Friday override not found" },
        { status: 404 }
      );
    }

    await prisma.fridayOverride.delete({
      where: { id },
    });

    return Response.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    if (message === "Forbidden")
      return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: message }, { status: 500 });
  }
}
