import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { EMPLOYEE_REMOVED, requireValidEmployee } from "@/lib/auth-utils";
import { calculateHoursFromRange } from "@/lib/working-hours";

export async function GET(request: NextRequest) {
  try {
    const user = await requireValidEmployee();
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get("startDate");
    const startTime = searchParams.get("startTime");
    const endDate = searchParams.get("endDate");
    const endTime = searchParams.get("endTime");

    if (!startDate || !startTime || !endDate || !endTime) {
      return Response.json(
        { error: "startDate, startTime, endDate, endTime are all required" },
        { status: 400 }
      );
    }
    const tre = /^\d{2}:\d{2}$/;
    if (!tre.test(startTime) || !tre.test(endTime)) {
      return Response.json({ error: "time must be HH:MM" }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return Response.json({ error: "invalid date" }, { status: 400 });
    }

    const holidays = await prisma.holiday.findMany({ select: { date: true } });
    const holidayDates = holidays.map((h) => h.date);

    try {
      const result = await calculateHoursFromRange(
        user.id,
        start,
        startTime,
        end,
        endTime,
        holidayDates
      );
      return Response.json({
        startDate: startDate.slice(0, 10),
        startTime,
        endDate: endDate.slice(0, 10),
        endTime,
        totalHours: result.totalHours,
        totalMinutes: result.totalMinutes,
        dailyBreakdown: result.dailyBreakdown.map((d) => ({
          date: d.date.toISOString().slice(0, 10),
          hours: d.hours,
        })),
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : "Invalid range";
      return Response.json({ error: m }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "Unauthorized") {
      return Response.json({ error: message }, { status: 401 });
    }
    if (message === EMPLOYEE_REMOVED) {
      return Response.json(
        { error: "Tài khoản không còn tồn tại. Vui lòng đăng nhập lại.", code: EMPLOYEE_REMOVED, forceLogout: true },
        { status: 401 }
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
