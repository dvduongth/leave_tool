import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash("191091", 10);
  await prisma.employee.update({
    where: { email: "hachiko@sgsa.jp" },
    data: { password: hash, mustChangePassword: true },
  });
  console.log("Admin password reset to 191091, mustChangePassword=true");
  await prisma.$disconnect();
}

main();
