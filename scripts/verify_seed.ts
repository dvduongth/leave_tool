import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [
    deptCount,
    empCount,
    adminCount,
    employeeCount,
    holidayCount,
    weekShiftCount,
    leaveBalCount,
    otBalCount,
    configCount,
    maleCount,
    femaleCount,
    mustChange,
  ] = await Promise.all([
    prisma.department.count(),
    prisma.employee.count(),
    prisma.employee.count({ where: { role: "ADMIN" } }),
    prisma.employee.count({ where: { role: "EMPLOYEE" } }),
    prisma.holiday.count(),
    prisma.employeeWeekShift.count(),
    prisma.leaveBalance.count(),
    prisma.oTBalance.count(),
    prisma.appConfig.count(),
    prisma.employee.count({ where: { gender: "MALE" } }),
    prisma.employee.count({ where: { gender: "FEMALE" } }),
    prisma.employee.count({ where: { mustChangePassword: true } }),
  ]);

  console.log("=== Seed verification ===");
  console.log(`Departments:           ${deptCount}    (expected: 1)`);
  console.log(`Total employees:       ${empCount}   (expected: 20)`);
  console.log(`  - ADMIN:             ${adminCount}    (expected: 1)`);
  console.log(`  - EMPLOYEE:          ${employeeCount}   (expected: 19)`);
  console.log(`  - MALE:              ${maleCount}    (expected: 1 — Nguyễn Văn Thành)`);
  console.log(`  - FEMALE:            ${femaleCount}   (expected: 18)`);
  console.log(`  - mustChangePassword:${mustChange}   (expected: 20)`);
  console.log(`Holidays:              ${holidayCount}    (expected: 6)`);
  console.log(`EmployeeWeekShift:     ${weekShiftCount}  (expected: 100 = 20 × 5 days)`);
  console.log(`LeaveBalance:          ${leaveBalCount}   (expected: 20)`);
  console.log(`OTBalance:             ${otBalCount}   (expected: 20)`);
  console.log(`AppConfig:             ${configCount}   (expected: 13)`);

  // Sample
  const admin = await prisma.employee.findUnique({ where: { email: "hachiko@sgsa.jp" } });
  console.log("\nAdmin sample:", { name: admin?.name, role: admin?.role, gender: admin?.gender });

  const male = await prisma.employee.findFirst({ where: { gender: "MALE" }, select: { name: true, email: true } });
  console.log("Male employee:", male);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
