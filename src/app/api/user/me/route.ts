import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

const ALLOWED_GENDERS = ["MALE", "FEMALE", "OTHER", "UNSPECIFIED"] as const;
const ALLOWED_LOCALES = ["vi", "en"] as const;

export async function GET() {
  try {
    const user = await requireAuth();
    const data = await prisma.employee.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        gender: true,
        preferredLocale: true,
        role: true,
        joinDate: true,
        birthDate: true,
        mustChangePassword: true,
        emailNotifEnabled: true,
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });
    if (!data) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "Unauthorized") return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { name, phone, gender, preferredLocale } = body ?? {};

    const updateData: {
      name?: string;
      phone?: string | null;
      gender?: "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";
      preferredLocale?: string;
    } = {};

    if (typeof name === "string" && name.trim().length > 0 && name.trim().length <= 100) {
      updateData.name = name.trim();
    }
    if (phone === null || (typeof phone === "string" && phone.length <= 30)) {
      updateData.phone = phone || null;
    }
    if (typeof gender === "string" && (ALLOWED_GENDERS as readonly string[]).includes(gender)) {
      updateData.gender = gender as "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";
    }
    if (
      typeof preferredLocale === "string" &&
      (ALLOWED_LOCALES as readonly string[]).includes(preferredLocale)
    ) {
      updateData.preferredLocale = preferredLocale;
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.employee.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        gender: true,
        preferredLocale: true,
      },
    });
    return Response.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "Unauthorized") return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
