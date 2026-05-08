import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  console.log("Audit log count:", logs.length);
  for (const l of logs) {
    console.log(
      l.createdAt.toISOString().slice(11, 19),
      l.action,
      l.entity ?? "-",
      "|",
      JSON.stringify(l.metadata)
    );
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
