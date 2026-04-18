import {
  BASE_ANNUAL_LEAVE_HOURS,
  SENIORITY_BONUS_HOURS_PER_TIER,
  SENIORITY_YEARS_PER_TIER,
} from "./constants";

/**
 * Returns full years between two dates (not counting partial years).
 * Uses calendar-year math so leap years don't skew results.
 */
export function yearsBetween(from: Date, to: Date): number {
  let years = to.getFullYear() - from.getFullYear();
  const monthDiff = to.getMonth() - from.getMonth();
  const dayDiff = to.getDate() - from.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years -= 1;
  }
  return Math.max(0, years);
}

/**
 * Calculates seniority bonus hours.
 * Every N complete years of service = +1 day (8h) of leave.
 *
 * Example: joinDate = 2020-01-01, asOf = 2026-01-01 → 6 years → 1 tier → +8h
 *          joinDate = 2015-01-01, asOf = 2026-01-01 → 11 years → 2 tiers → +16h
 */
export function calculateSeniorityBonusHours(
  joinDate: Date | null | undefined,
  asOf: Date
): number {
  if (!joinDate) return 0;
  const years = yearsBetween(joinDate, asOf);
  const tiers = Math.floor(years / SENIORITY_YEARS_PER_TIER);
  return tiers * SENIORITY_BONUS_HOURS_PER_TIER;
}

/**
 * Total annual leave hours including seniority bonus, as of a given date.
 */
export function totalAnnualLeaveHours(
  joinDate: Date | null | undefined,
  asOf: Date
): number {
  return BASE_ANNUAL_LEAVE_HOURS + calculateSeniorityBonusHours(joinDate, asOf);
}
