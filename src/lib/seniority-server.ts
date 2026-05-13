import { getConfigNumber } from "./config";
import { getJune1stAnchor, getJune1stMilestone } from "./seniority";

/**
 * Async version that respects admin-tuned config from DB.
 * Uses June 1st cycle for seniority calculation (generous to employees).
 * SERVER-ONLY — do not import from client components.
 */
export async function totalAnnualLeaveHoursFromConfig(
  joinDate: Date | null | undefined,
  asOf: Date
): Promise<number> {
  const base = await getConfigNumber("BASE_ANNUAL_LEAVE_HOURS");
  if (!joinDate) return base;

  const yearsPerTier = await getConfigNumber("SENIORITY_YEARS_PER_TIER");
  const bonusPerTier = await getConfigNumber("SENIORITY_BONUS_HOURS_PER_TIER");

  const anchor = getJune1stAnchor(joinDate);
  const milestone = getJune1stMilestone(asOf);

  if (milestone < anchor) return base;

  const years = milestone.getFullYear() - anchor.getFullYear();
  const tiers = Math.floor(years / yearsPerTier);
  return base + tiers * bonusPerTier;
}
