import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const ots = await prisma.oTRecord.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  console.log("Recent OT records:");
  for (const ot of ots) {
    console.log(
      "  ",
      ot.id.slice(0, 8),
      ot.status,
      `${ot.otMinutes}min`,
      "balance=",
      ot.otBalanceId?.slice(0, 8) ?? "null"
    );
  }

  const bals = await prisma.oTBalance.findMany({ where: { totalMinutes: { gt: 0 } } });
  console.log("\nOTBalance with totalMinutes > 0:");
  for (const b of bals) {
    console.log(
      "  ",
      b.cycleYear,
      `total=${b.totalMinutes}`,
      `used=${b.usedMinutes}`,
      `remaining=${b.totalMinutes - b.usedMinutes - b.pendingMinutes}`
    );
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
