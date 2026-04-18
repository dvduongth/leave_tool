import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { isLocale } from "@/lib/i18n";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { locale } = await request.json();
    if (!isLocale(locale)) {
      return Response.json({ error: "Invalid locale" }, { status: 400 });
    }
    await prisma.employee.update({
      where: { id: user.id },
      data: { preferredLocale: locale },
    });
    return Response.json({ ok: true, locale });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
