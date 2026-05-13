import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { parseDateInput } from "@/lib/date-utils";
import { getConfigNumber } from "@/lib/config";
import { createNotification } from "@/lib/notifications";
import { MenstrualMode, MenstrualStatus } from "@/generated/prisma";

const MODE_DURATIONS: Record<MenstrualMode, number> = {
  SHORT: 30,
  MEDIUM: 60,
  LONG: 90,
};

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

function addMinutesToTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { date, startTime, mode, note } = body;

    if (!date || !startTime) {
      return Response.json(
        { error: "Missing required fields: date, startTime" },
        { status: 400 }
      );
    }

    // Validate mode
    const selectedMode: MenstrualMode =
      mode === "LONG" ? MenstrualMode.LONG : MenstrualMode.SHORT;
    const durationMins = MODE_DURATIONS[selectedMode];

    const noteTrimmed = typeof note === "string" ? note.trim() : "";
    if (!noteTrimmed) {
      return Response.json({ error: "Vui lòng nhập lý do" }, { status: 400 });
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

    // Calculate endTime based on mode
    const endTime = addMinutesToTime(startTime, durationMins);

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
        mode: selectedMode,
        status: MenstrualStatus.PENDING_MANAGER,
        note: noteTrimmed,
      },
    });

    // Notify manager for approval
    if (employee.managerId) {
      await createNotification(
        employee.managerId,
        "Wellness leave pending approval",
        `${employee.name} requested a ${durationMins}-minute wellness break on ${date}`,
        `/approvals`
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
