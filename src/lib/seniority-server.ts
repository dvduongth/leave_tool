import { getConfigNumber } from "./config";
import { yearsBetween } from "./seniority";

/**
 * Async version that respects admin-tuned config from DB.
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
  const years = yearsBetween(joinDate, asOf);
  const tiers = Math.floor(years / yearsPerTier);
  return base + tiers * bonusPerTier;
}
