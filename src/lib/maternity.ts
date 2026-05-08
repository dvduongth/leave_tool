import prisma from "@/lib/prisma";
import { getConfigNumber } from "@/lib/config";

/**
 * Add `months` to a date (calendar-correct, leap-year safe).
 */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // If overflow (e.g. Jan 31 + 1m), pull back to last day of target month
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d;
}

/**
 * Returns the APPROVED child whose birthDate is still within the maternity
 * eligibility window for `asOf`, or null if no such child exists.
 *
 * Window: child.birthDate <= asOf < birthDate + N months (exclusive upper bound).
 */
export async function findEligibleChild(
  employeeId: string,
  asOf: Date
): Promise<{ id: string; birthDate: Date; name: string | null } | null> {
  const limitMonths = await getConfigNumber("MATERNITY_CHILD_AGE_LIMIT_MONTHS");
  const lowerBirthDate = addMonths(asOf, -limitMonths);

  const child = await prisma.employeeChild.findFirst({
    where: {
      employeeId,
      status: "APPROVED",
      birthDate: { gt: lowerBirthDate, lte: asOf },
    },
    orderBy: { birthDate: "desc" },
    select: { id: true, birthDate: true, name: true },
  });

  if (!child) return null;
  // Strict exclusive upper bound check (< birthDate + limitMonths)
  const upper = addMonths(child.birthDate, limitMonths);
  if (asOf >= upper) return null;
  return child;
}
