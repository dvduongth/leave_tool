import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

(async () => {
  const u = await prisma.employee.findUnique({ where: { email: "admin@company.com" } });
  console.log("User found:", !!u);
  if (u) {
    console.log("Email:", u.email, "Role:", u.role);
    console.log("Hash prefix:", u.password.substring(0, 15));
    console.log("Hash length:", u.password.length);
    console.log("bcrypt.compare(password123):", await bcrypt.compare("password123", u.password));
  }
  await prisma.$disconnect();
})();
