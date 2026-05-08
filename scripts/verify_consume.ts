import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const leaves = await prisma.leaveRequest.findMany({
    where: { status: "APPROVED" },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: { id: true, totalHours: true, otConsumedMinutes: true, employee: { select: { name: true } } },
  });
  console.log("Approved leaves:");
  for (const l of leaves) {
    console.log(
      "  ",
      l.id.slice(0, 8),
      l.employee.name,
      `${l.totalHours}h`,
      `otConsumed=${l.otConsumedMinutes}min`
    );
  }

  const consumptions = await prisma.leaveOTConsumption.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log("\nLeaveOTConsumption rows:");
  for (const c of consumptions) {
    console.log(
      "  ",
      c.id.slice(0, 8),
      "leave=",
      c.leaveRequestId.slice(0, 8),
      "balance=",
      c.otBalanceId.slice(0, 8),
      `${c.minutes}min`
    );
  }

  const balances = await prisma.oTBalance.findMany({ where: { totalMinutes: { gt: 0 } } });
  console.log("\nOTBalances with activity:");
  for (const b of balances) {
    console.log(
      "  ",
      `cycle=${b.cycleYear}`,
      `total=${b.totalMinutes}`,
      `used=${b.usedMinutes}`,
      `pending=${b.pendingMinutes}`,
      `remain=${b.totalMinutes - b.usedMinutes - b.pendingMinutes}`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
