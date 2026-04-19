import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { parseDateInput } from "@/lib/date-utils";
import { getConfigNumber } from "@/lib/config";
import { createNotification } from "@/lib/notifications";

function yearMonthOf(d: Date): { start: Date; end: Date } {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1)),
    end: new Date(Date.UTC(y, m + 1, 1)),
  };
}

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = request.nextUrl;
    const month = searchParams.get("month"); // YYYY-MM optional

    const where: { employeeId: string; date?: { gte: Date; lt: Date } } = {
      employeeId: user.id,
    };

    if (month) {
      const [y, m] = month.split("-").map(Number);
      where.date = {
        gte: new Date(Date.UTC(y, m - 1, 1)),
        lt: new Date(Date.UTC(y, m, 1)),
      };
    }

    const records = await prisma.menstrualLeave.findMany({
      where,
      orderBy: { date: "desc" },
    });

    // Summary for current month
    const now = new Date();
    const { start, end } = yearMonthOf(now);
    const thisMonth = await prisma.menstrualLeave.count({
      where: {
        employeeId: user.id,
        date: { gte: start, lt: end },
      },
    });
    const maxPerMonth = await getConfigNumber(
      "MENSTRUAL_LEAVE_MAX_DAYS_PER_MONTH"
    );
    const durationMin = await getConfigNumber(
      "MENSTRUAL_LEAVE_DURATION_MINUTES"
    );

    return Response.json({
      records,
      summary: {
        thisMonthUsed: thisMonth,
        maxPerMonth,
        durationMinutes: durationMin,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { date, startTime, endTime, note } = body;

    if (!date || !startTime || !endTime) {
      return Response.json(
        { error: "Missing required fields: date, startTime, endTime" },
        { status: 400 }
      );
    }

    // Only FEMALE employees may submit
    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { gender: true, name: true, managerId: true, departmentId: true },
    });
    if (!employee || employee.gender !== "FEMALE") {
      return Response.json(
        { error: "Only FEMALE employees are eligible for this leave type" },
        { status: 403 }
      );
    }

    const parsedDate = parseDateInput(date);
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      return Response.json({ error: "Invalid date" }, { status: 400 });
    }

    // Validate duration ~ configured minutes (allow exact match)
    const expectedMinutes = await getConfigNumber(
      "MENSTRUAL_LEAVE_DURATION_MINUTES"
    );
    const actualMinutes = durationMinutes(startTime, endTime);
    if (actualMinutes !== expectedMinutes) {
      return Response.json(
        {
          error: `Duration must be exactly ${expectedMinutes} minutes (got ${actualMinutes})`,
        },
        { status: 400 }
      );
    }

    // Enforce monthly limit
    const { start, end } = yearMonthOf(parsedDate);
    const usedThisMonth = await prisma.menstrualLeave.count({
      where: {
        employeeId: user.id,
        date: { gte: start, lt: end },
      },
    });
    const maxPerMonth = await getConfigNumber(
      "MENSTRUAL_LEAVE_MAX_DAYS_PER_MONTH"
    );
    if (usedThisMonth >= maxPerMonth) {
      return Response.json(
        {
          error: `Monthly limit reached (${maxPerMonth} days). Already used ${usedThisMonth} this month.`,
        },
        { status: 400 }
      );
    }

    // One per day enforced by unique(employeeId, date)
    const record = await prisma.menstrualLeave.create({
      data: {
        employeeId: user.id,
        date: parsedDate,
        startTime,
        endTime,
        note: note || null,
      },
    });

    // Notify manager for awareness (auto-approved, no action needed).
    if (employee.managerId) {
      await createNotification(
        employee.managerId,
        "Menstrual leave logged",
        `${employee.name} logged a ${expectedMinutes}-minute wellness break on ${date}`,
        `/wellness`
      );
    }

    return Response.json(record, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    // Prisma unique constraint
    if (message.includes("Unique constraint")) {
      return Response.json(
        { error: "Already logged for this date" },
        { status: 409 }
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
