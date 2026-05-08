import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const b = await prisma.leaveBalance.findFirst({
    where: { employee: { email: "hachiko@sgsa.jp" } },
  });
  if (b) {
    console.log(
      "Admin LeaveBalance: total=",
      b.totalHours,
      "used=",
      b.usedHours,
      "pending=",
      b.pendingHours,
      "remaining=",
      b.totalHours - b.usedHours - b.pendingHours
    );
  }
  await prisma.$disconnect();
}

main();
