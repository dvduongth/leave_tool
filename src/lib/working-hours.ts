import type { ShiftType } from "@/generated/prisma";

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
 * Returns the working ranges and total minutes for a given shift on a given date.
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

/**
 * Returns true if the date is a working day (not Sat/Sun/holiday).
 */
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

/**
 * Calculates when a leave ends by consuming working hours forward from startDate/startTime.
 *
 * Algorithm:
 * 1. Start at startTime on startDate.
 * 2. On current day, get working ranges for this shift.
 * 3. Find which range the startTime falls in (or the next range after it).
 * 4. Count available minutes from startTime to end of range, then subsequent ranges.
 * 5. If remaining minutes > available today, consume today's available, move to next working day.
 * 6. Skip weekends and holidays.
 * 7. Repeat until all minutes consumed.
 */
export function calculateLeaveEnd(
  shift: ShiftType,
  startDate: Date,
  startTime: string,
  totalHours: number,
  holidays: Date[]
): {
  endDate: Date;
  endTime: string;
  dailyBreakdown: { date: Date; hours: number }[];
} {
  let remainingMinutes = Math.round(totalHours * 60);
  const dailyBreakdown: { date: Date; hours: number }[] = [];

  let currentDate = new Date(startDate);
  let currentTimeMinutes = timeToMinutes(startTime);

  // Safety: cap iterations to prevent infinite loops
  const maxIterations = 365;
  let iterations = 0;

  while (remainingMinutes > 0 && iterations < maxIterations) {
    iterations++;

    // Skip non-working days
    if (!isWorkingDay(currentDate, holidays)) {
      currentDate = addDays(currentDate, 1);
      currentTimeMinutes = 0; // will be set to first range start below
      continue;
    }

    const workingDay = getWorkingRanges(shift, currentDate);
    if (!workingDay) {
      currentDate = addDays(currentDate, 1);
      currentTimeMinutes = 0;
      continue;
    }

    const { ranges } = workingDay;

    // If this is not the first day (or if currentTimeMinutes is 0/before first range),
    // start from the beginning of the first range
    const firstRangeStart = timeToMinutes(ranges[0].start);
    if (currentTimeMinutes < firstRangeStart) {
      currentTimeMinutes = firstRangeStart;
    }

    let consumedToday = 0;

    for (const range of ranges) {
      if (remainingMinutes <= 0) break;

      const rangeStart = timeToMinutes(range.start);
      const rangeEnd = timeToMinutes(range.end);

      // Skip ranges that are entirely before our current time
      if (currentTimeMinutes >= rangeEnd) continue;

      // Effective start within this range
      const effectiveStart = Math.max(currentTimeMinutes, rangeStart);
      const availableInRange = rangeEnd - effectiveStart;

      if (availableInRange <= 0) continue;

      if (remainingMinutes <= availableInRange) {
        // Leave ends within this range
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
        // Consume entire remaining range
        consumedToday += availableInRange;
        remainingMinutes -= availableInRange;
        currentTimeMinutes = rangeEnd;
      }
    }

    // Record today's consumption
    if (consumedToday > 0) {
      dailyBreakdown.push({
        date: new Date(currentDate),
        hours: consumedToday / 60,
      });
    }

    // Move to next day
    currentDate = addDays(currentDate, 1);
    currentTimeMinutes = 0; // will snap to first range start on next iteration
  }

  // Edge case: all minutes consumed exactly at end of a day's last range
  // (handled by the return inside the loop, but just in case)
  const lastDay = getWorkingRanges(shift, currentDate);
  const fallbackTime = lastDay
    ? lastDay.ranges[lastDay.ranges.length - 1].end
    : minutesToTime(currentTimeMinutes);

  return {
    endDate: new Date(currentDate),
    endTime: fallbackTime,
    dailyBreakdown,
  };
}
