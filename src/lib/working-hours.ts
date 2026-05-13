import type { ShiftType } from "@/generated/prisma";
import prisma from "@/lib/prisma";

// Shift definitions: each shift has weekday (Mon-Thu) and Friday ranges
const SHIFT_CONFIG: Record<
  ShiftType,
  {
    weekday: { start: string; end: string }[];
    friday: { start: string; end: string }[];
  }
> = {
  A: {
    weekday: [
      { start: "07:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
    ],
    friday: [
      { start: "07:00", end: "12:00" },
      { start: "13:00", end: "16:00" },
    ],
  },
  B: {
    weekday: [
      { start: "07:30", end: "12:00" },
      { start: "13:00", end: "17:30" },
    ],
    friday: [
      { start: "07:30", end: "12:00" },
      { start: "13:00", end: "16:30" },
    ],
  },
  C: {
    weekday: [
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "19:00" },
    ],
    friday: [
      { start: "10:00", end: "12:00" },
      { start: "13:00", end: "19:00" },
    ],
  },
  D: {
    weekday: [
      { start: "08:00", end: "12:00" },
      { start: "13:00", end: "18:00" },
    ],
    friday: [
      { start: "08:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
    ],
  },
};

export function timeToMinutes(time: string): number {
  const parts = time.split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Pure config lookup: returns the working ranges for a given shift on a given date.
 * Returns null for Saturday (6) and Sunday (0).
 */
export function getWorkingRanges(
  shift: ShiftType,
  date: Date
): { ranges: { start: string; end: string }[]; totalMinutes: number } | null {
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  if (day === 0 || day === 6) return null;

  const config = SHIFT_CONFIG[shift];
  const ranges = day === 5 ? config.friday : config.weekday;

  const totalMinutes = ranges.reduce((sum, r) => {
    return sum + (timeToMinutes(r.end) - timeToMinutes(r.start));
  }, 0);

  return { ranges, totalMinutes };
}

export function isWorkingDay(date: Date, holidays?: Date[]): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;

  if (holidays) {
    const dateStr = formatDateKey(date);
    for (const h of holidays) {
      if (formatDateKey(h) === dateStr) return false;
    }
  }

  return true;
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

interface ShiftHistoryEntry {
  dayOfWeek: number;
  shiftType: ShiftType;
  effectiveDate: Date;
  endDate: Date | null;
}

/**
 * Loads all per-day shift assignments for an employee. Used as input to
 * resolveShiftForDate so callers can do a single DB round-trip per leave
 * calculation instead of N round-trips (one per day).
 */
export async function loadShiftHistory(
  employeeId: string
): Promise<{ history: ShiftHistoryEntry[]; fallback: ShiftType }> {
  const [history, employee] = await Promise.all([
    prisma.employeeWeekShift.findMany({
      where: { employeeId },
      select: { dayOfWeek: true, shiftType: true, effectiveDate: true, endDate: true },
      orderBy: { effectiveDate: "asc" },
    }),
    prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      select: { workShift: true },
    }),
  ]);
  return { history, fallback: employee.workShift };
}

/**
 * Resolves the shift active for a given dayOfWeek on a specific date.
 * Picks the row with the latest effectiveDate that is <= date and whose
 * endDate (if set) is >= date. Falls back to Employee.workShift when no
 * matching row exists.
 */
export function resolveShiftFromHistory(
  history: ShiftHistoryEntry[],
  dayOfWeek: number,
  date: Date,
  fallback: ShiftType
): ShiftType {
  let best: ShiftHistoryEntry | null = null;
  for (const row of history) {
    if (row.dayOfWeek !== dayOfWeek) continue;
    if (row.effectiveDate > date) continue;
    if (row.endDate && row.endDate < date) continue;
    if (!best || row.effectiveDate > best.effectiveDate) best = row;
  }
  return best?.shiftType ?? fallback;
}

/**
 * Single-shot helper: returns the shift active for `employeeId` on `date`.
 * Performs 2 DB queries — prefer `loadShiftHistory` + `resolveShiftFromHistory`
 * inside loops.
 */
export async function getShiftForDate(employeeId: string, date: Date): Promise<ShiftType> {
  const { history, fallback } = await loadShiftHistory(employeeId);
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return fallback;
  return resolveShiftFromHistory(history, dow, date, fallback);
}

/**
 * Calculates when a leave ends by consuming working hours forward from
 * startDate/startTime, using the employee's per-day shift schedule.
 */
export async function calculateLeaveEnd(
  employeeId: string,
  startDate: Date,
  startTime: string,
  totalHours: number,
  holidays: Date[]
): Promise<{
  endDate: Date;
  endTime: string;
  dailyBreakdown: { date: Date; hours: number }[];
}> {
  const { history, fallback } = await loadShiftHistory(employeeId);

  let remainingMinutes = Math.round(totalHours * 60);
  const dailyBreakdown: { date: Date; hours: number }[] = [];

  let currentDate = new Date(startDate);
  let currentTimeMinutes = timeToMinutes(startTime);

  const maxIterations = 365;
  let iterations = 0;

  while (remainingMinutes > 0 && iterations < maxIterations) {
    iterations++;

    if (!isWorkingDay(currentDate, holidays)) {
      currentDate = addDays(currentDate, 1);
      currentTimeMinutes = 0;
      continue;
    }

    const dow = currentDate.getDay();
    const shift = resolveShiftFromHistory(history, dow, currentDate, fallback);
    const workingDay = getWorkingRanges(shift, currentDate);
    if (!workingDay) {
      currentDate = addDays(currentDate, 1);
      currentTimeMinutes = 0;
      continue;
    }

    const { ranges } = workingDay;
    const firstRangeStart = timeToMinutes(ranges[0].start);
    if (currentTimeMinutes < firstRangeStart) {
      currentTimeMinutes = firstRangeStart;
    }

    let consumedToday = 0;

    for (const range of ranges) {
      if (remainingMinutes <= 0) break;

      const rangeStart = timeToMinutes(range.start);
      const rangeEnd = timeToMinutes(range.end);

      if (currentTimeMinutes >= rangeEnd) continue;

      const effectiveStart = Math.max(currentTimeMinutes, rangeStart);
      const availableInRange = rangeEnd - effectiveStart;

      if (availableInRange <= 0) continue;

      if (remainingMinutes <= availableInRange) {
        const endTimeMinutes = effectiveStart + remainingMinutes;
        consumedToday += remainingMinutes;
        remainingMinutes = 0;

        if (consumedToday > 0) {
          dailyBreakdown.push({
            date: new Date(currentDate),
            hours: consumedToday / 60,
          });
        }

        return {
          endDate: new Date(currentDate),
          endTime: minutesToTime(endTimeMinutes),
          dailyBreakdown,
        };
      } else {
        consumedToday += availableInRange;
        remainingMinutes -= availableInRange;
        currentTimeMinutes = rangeEnd;
      }
    }

    if (consumedToday > 0) {
      dailyBreakdown.push({
        date: new Date(currentDate),
        hours: consumedToday / 60,
      });
    }

    currentDate = addDays(currentDate, 1);
    currentTimeMinutes = 0;
  }

  // Fallback: use the last day's shift to derive end time
  const lastDow = currentDate.getDay();
  const lastShift = resolveShiftFromHistory(history, lastDow, currentDate, fallback);
  const lastDay = getWorkingRanges(lastShift, currentDate);
  const fallbackTime = lastDay
    ? lastDay.ranges[lastDay.ranges.length - 1].end
    : minutesToTime(currentTimeMinutes);

  return {
    endDate: new Date(currentDate),
    endTime: fallbackTime,
    dailyBreakdown,
  };
}

function sameDate(a: Date, b: Date): boolean {
  return formatDateKey(a) === formatDateKey(b);
}

/**
 * Calculates total leave hours given a (startDate, startTime) → (endDate, endTime) range.
 * Sums working minutes per day intersected with [start, end] window, using each day's
 * per-day shift schedule. Skips weekends and holidays. Rounds total to nearest 0.25h.
 */
export async function calculateHoursFromRange(
  employeeId: string,
  startDate: Date,
  startTime: string,
  endDate: Date,
  endTime: string,
  holidays: Date[]
): Promise<{
  totalHours: number;
  totalMinutes: number;
  dailyBreakdown: { date: Date; hours: number }[];
}> {
  // Validate ordering
  const startKey = formatDateKey(startDate);
  const endKey = formatDateKey(endDate);
  if (endKey < startKey) {
    throw new Error("endDate must be on or after startDate");
  }
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  if (startKey === endKey && endMin <= startMin) {
    throw new Error("endTime must be after startTime on the same day");
  }

  const { history, fallback } = await loadShiftHistory(employeeId);
  const dailyBreakdown: { date: Date; hours: number }[] = [];
  let totalMinutes = 0;

  let currentDate = new Date(startDate);
  const maxIterations = 365;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;
    const isFirst = sameDate(currentDate, startDate);
    const isLast = sameDate(currentDate, endDate);

    if (!isWorkingDay(currentDate, holidays)) {
      if (isLast) break;
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const dow = currentDate.getDay();
    const shift = resolveShiftFromHistory(history, dow, currentDate, fallback);
    const workingDay = getWorkingRanges(shift, currentDate);

    if (workingDay) {
      const windowStart = isFirst ? startMin : 0;
      const windowEnd = isLast ? endMin : 24 * 60;

      let consumedToday = 0;
      for (const range of workingDay.ranges) {
        const rs = timeToMinutes(range.start);
        const re = timeToMinutes(range.end);
        const lo = Math.max(rs, windowStart);
        const hi = Math.min(re, windowEnd);
        if (hi > lo) consumedToday += hi - lo;
      }
      if (consumedToday > 0) {
        totalMinutes += consumedToday;
        dailyBreakdown.push({
          date: new Date(currentDate),
          hours: consumedToday / 60,
        });
      }
    }

    if (isLast) break;
    currentDate = addDays(currentDate, 1);
  }

  // Round totalMinutes to nearest 15-minute step (0.25h)
  const roundedMinutes = Math.round(totalMinutes / 15) * 15;
  return {
    totalHours: roundedMinutes / 60,
    totalMinutes: roundedMinutes,
    dailyBreakdown,
  };
}
