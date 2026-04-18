/**
 * One-off cleanup script:
 *   1. Clamp any `usedHours < 0` back to 0 (caused by old double-restore bug).
 *   2. Recompute `totalHours` for all active leave balances based on joinDate
 *      (so seniority bonus is reflected in existing rows).
 *
 * Usage:
 *   npx tsx scripts/cleanup-balances.ts
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { totalAnnualLeaveHours } from "../src/lib/seniority";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log("--- Leave balance cleanup ---\n");

  // 1. Clamp negative usedHours
  const clamped = await prisma.$executeRaw`
    UPDATE leave_balances
    SET used_hours = 0
    WHERE used_hours < 0
  `;
  console.log(`✓ Clamped ${clamped} row(s) with negative used_hours to 0.`);

  // 2. Recompute totalHours by joinDate for every balance
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      name: true,
      joinDate: true,
      leaveBalances: {
        select: {
          id: true,
          cycleYear: true,
          cycleStart: true,
          totalHours: true,
        },
      },
    },
  });

  let updated = 0;
  let unchanged = 0;
  for (const emp of employees) {
    for (const b of emp.leaveBalances) {
      const expected = totalAnnualLeaveHours(emp.joinDate, b.cycleStart);
      if (expected !== b.totalHours) {
        await prisma.leaveBalance.update({
          where: { id: b.id },
          data: { totalHours: expected },
        });
        console.log(
          `  • ${emp.name} cycle ${b.cycleYear}: ${b.totalHours}h → ${expected}h`
        );
        updated++;
      } else {
        unchanged++;
      }
    }
  }
  console.log(
    `\n✓ Recomputed totalHours: ${updated} updated, ${unchanged} unchanged.`
  );
  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
