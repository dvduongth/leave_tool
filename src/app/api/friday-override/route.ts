import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";
import { Role } from "@/generated/prisma";

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN", "HEAD");
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = {};
    if (from) {
      where.weekStart = { ...(where.weekStart as object || {}), gte: new Date(from) };
    }
    if (to) {
      where.weekStart = { ...(where.weekStart as object || {}), lte: new Date(to) };
    }

    const overrides = await prisma.fridayOverride.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
      },
      orderBy: { weekStart: "asc" },
    });

    return Response.json(overrides);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    if (message === "Forbidden")
      return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN", "HEAD");
    const body = await request.json();
    const { weekStart, note } = body;

    if (!weekStart) {
      return Response.json(
        { error: "weekStart is required" },
        { status: 400 }
      );
    }

    const parsedDate = new Date(weekStart);
    if (isNaN(parsedDate.getTime())) {
      return Response.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // Validate that weekStart is a Monday
    const monday = getMondayOfWeek(parsedDate);
    if (monday.getTime() !== parsedDate.getTime()) {
      return Response.json(
        { error: "weekStart must be a Monday" },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.fridayOverride.findUnique({
      where: { weekStart: monday },
    });
    if (existing) {
      return Response.json(
        { error: "Friday override already exists for this week" },
        { status: 409 }
      );
    }

    const override = await prisma.fridayOverride.create({
      data: {
        weekStart: monday,
        note: note || null,
        createdBy: user.id,
      },
      include: {
        creator: { select: { id: true, name: true } },
      },
    });

    return Response.json(override, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    if (message === "Forbidden")
      return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: message }, { status: 500 });
  }
}
