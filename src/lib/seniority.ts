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
 * Returns June 1st BEFORE joinDate (fiscal year start when employee joined).
 * Generous to employees: partial year counts as full year toward seniority.
 * - Join before June 1st → anchor = June 1st of previous year
 * - Join on/after June 1st → anchor = June 1st of same year
 */
export function getJune1stAnchor(joinDate: Date): Date {
  const year = joinDate.getFullYear();
  const june1 = new Date(year, 5, 1); // month is 0-indexed
  if (joinDate < june1) return new Date(year - 1, 5, 1);
  return june1;
}

/**
 * Returns June 1st on or before asOf (most recent milestone).
 */
export function getJune1stMilestone(asOf: Date): Date {
  const year = asOf.getFullYear();
  const june1 = new Date(year, 5, 1);
  if (asOf >= june1) return june1;
  return new Date(year - 1, 5, 1);
}

/**
 * Calculates seniority bonus hours based on June 1st cycle.
 * Every 5 complete fiscal years of service = +1 day (8h) of leave.
 *
 * Logic (generous to employees):
 * - anchorDate = June 1st BEFORE joinDate
 * - milestone = June 1st on or before asOf
 * - seniority years = milestone.year - anchor.year
 * - tiers = floor(seniority years / 5)
 *
 * Example: joinDate = 2020-03-15, asOf = 2024-06-01
 *          anchor = 2019-06-01, milestone = 2024-06-01
 *          years = 5 → 1 tier → +8h
 */
export function calculateSeniorityBonusHours(
  joinDate: Date | null | undefined,
  asOf: Date
): number {
  if (!joinDate) return 0;

  const anchor = getJune1stAnchor(joinDate);
  const milestone = getJune1stMilestone(asOf);

  if (milestone < anchor) return 0;

  const years = milestone.getFullYear() - anchor.getFullYear();
  const tiers = Math.floor(years / SENIORITY_YEARS_PER_TIER);
  return tiers * SENIORITY_BONUS_HOURS_PER_TIER;
}

/**
 * Total annual leave hours including seniority bonus, as of a given date.
 * Sync version uses compiled-in defaults (for client-side UI display).
 */
export function totalAnnualLeaveHours(
  joinDate: Date | null | undefined,
  asOf: Date
): number {
  return BASE_ANNUAL_LEAVE_HOURS + calculateSeniorityBonusHours(joinDate, asOf);
}

