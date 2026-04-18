import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = request.nextUrl;
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const holidays = await prisma.holiday.findMany({
      where: { year },
      orderBy: { date: "asc" },
    });

    return Response.json(holidays);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await request.json();
    const { date, name, year } = body;

    if (!date || !name || !year) {
      return Response.json(
        { error: "Missing required fields: date, name, year" },
        { status: 400 }
      );
    }

    // Accept "YYYY-MM-DD" (preferred) or full ISO. Normalise to UTC midnight
    // so Postgres DATE column stores exactly the day the user picked — no
    // timezone shift regardless of server TZ.
    let parsedDate: Date;
    const ymdMatch = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.exec(date);
    if (ymdMatch) {
      parsedDate = new Date(`${date}T00:00:00.000Z`);
    } else {
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        return Response.json({ error: "Invalid date" }, { status: 400 });
      }
      parsedDate = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      );
    }
    if (isNaN(parsedDate.getTime())) {
      return Response.json({ error: "Invalid date" }, { status: 400 });
    }

    // Check for duplicate date
    const existing = await prisma.holiday.findUnique({
      where: { date: parsedDate },
    });
    if (existing) {
      return Response.json(
        { error: "A holiday already exists on this date" },
        { status: 409 }
      );
    }

    const holiday = await prisma.holiday.create({
      data: {
        date: parsedDate,
        name,
        year: parseInt(String(year), 10),
      },
    });

    return Response.json(holiday, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    if (message === "Forbidden")
      return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");

    if (!id) {
      return Response.json(
        { error: "Missing required query param: id" },
        { status: 400 }
      );
    }

    const existing = await prisma.holiday.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Holiday not found" }, { status: 404 });
    }

    await prisma.holiday.delete({ where: { id } });

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
