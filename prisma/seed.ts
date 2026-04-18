import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // --- Work Shifts ---
  await prisma.workShift.upsert({
    where: { id: "A" },
    update: {},
    create: {
      id: "A",
      label: "7:00–17:00",
      weekdayStart: "07:00",
      weekdayEnd: "17:00",
      fridayStart: "07:00",
      fridayEnd: "16:00",
    },
  });
  await prisma.workShift.upsert({
    where: { id: "B" },
    update: {},
    create: {
      id: "B",
      label: "7:30–17:30",
      weekdayStart: "07:30",
      weekdayEnd: "17:30",
      fridayStart: "07:30",
      fridayEnd: "16:30",
    },
  });
  await prisma.workShift.upsert({
    where: { id: "C" },
    update: {},
    create: {
      id: "C",
      label: "9:00–19:00",
      weekdayStart: "09:00",
      weekdayEnd: "19:00",
      fridayStart: "10:00",
      fridayEnd: "19:00",
    },
  });

  // --- Departments ---
  const engineering = await prisma.department.upsert({
    where: { id: "dept-engineering" },
    update: {},
    create: { id: "dept-engineering", name: "Engineering" },
  });
  const product = await prisma.department.upsert({
    where: { id: "dept-product" },
    update: {},
    create: { id: "dept-product", name: "Product" },
  });

  // --- Employees ---
  const admin = await prisma.employee.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@company.com",
      password: passwordHash,
      role: "ADMIN",
      workShift: "A",
      departmentId: engineering.id,
    },
  });

  const headEng = await prisma.employee.upsert({
    where: { email: "head.eng@company.com" },
    update: {},
    create: {
      name: "Head Eng",
      email: "head.eng@company.com",
      password: passwordHash,
      role: "HEAD",
      workShift: "A",
      departmentId: engineering.id,
    },
  });

  const headProduct = await prisma.employee.upsert({
    where: { email: "head.product@company.com" },
    update: {},
    create: {
      name: "Head Product",
      email: "head.product@company.com",
      password: passwordHash,
      role: "HEAD",
      workShift: "B",
      departmentId: product.id,
    },
  });

  // Set department heads
  await prisma.department.update({
    where: { id: engineering.id },
    data: { headId: headEng.id },
  });
  await prisma.department.update({
    where: { id: product.id },
    data: { headId: headProduct.id },
  });

  const manager1 = await prisma.employee.upsert({
    where: { email: "manager1@company.com" },
    update: {},
    create: {
      name: "Manager 1",
      email: "manager1@company.com",
      password: passwordHash,
      role: "MANAGER",
      workShift: "A",
      departmentId: engineering.id,
      managerId: headEng.id,
    },
  });

  const manager2 = await prisma.employee.upsert({
    where: { email: "manager2@company.com" },
    update: {},
    create: {
      name: "Manager 2",
      email: "manager2@company.com",
      password: passwordHash,
      role: "MANAGER",
      workShift: "B",
      departmentId: product.id,
      managerId: headProduct.id,
    },
  });

  const emp1 = await prisma.employee.upsert({
    where: { email: "emp1@company.com" },
    update: {},
    create: {
      name: "Employee 1",
      email: "emp1@company.com",
      password: passwordHash,
      role: "EMPLOYEE",
      workShift: "A",
      departmentId: engineering.id,
      managerId: manager1.id,
    },
  });

  const emp2 = await prisma.employee.upsert({
    where: { email: "emp2@company.com" },
    update: {},
    create: {
      name: "Employee 2",
      email: "emp2@company.com",
      password: passwordHash,
      role: "EMPLOYEE",
      workShift: "B",
      departmentId: engineering.id,
      managerId: manager1.id,
    },
  });

  const emp3 = await prisma.employee.upsert({
    where: { email: "emp3@company.com" },
    update: {},
    create: {
      name: "Employee 3",
      email: "emp3@company.com",
      password: passwordHash,
      role: "EMPLOYEE",
      workShift: "B",
      departmentId: product.id,
      managerId: manager2.id,
    },
  });

  const emp4 = await prisma.employee.upsert({
    where: { email: "emp4@company.com" },
    update: {},
    create: {
      name: "Employee 4",
      email: "emp4@company.com",
      password: passwordHash,
      role: "EMPLOYEE",
      workShift: "C",
      departmentId: product.id,
      managerId: manager2.id,
    },
  });

  // --- Leave Balances ---
  const allEmployees = [admin, headEng, headProduct, manager1, manager2, emp1, emp2, emp3, emp4];

  for (const emp of allEmployees) {
    // Current cycle 2026
    await prisma.leaveBalance.upsert({
      where: { employeeId_cycleYear: { employeeId: emp.id, cycleYear: 2026 } },
      update: {},
      create: {
        employeeId: emp.id,
        cycleYear: 2026,
        cycleStart: new Date("2026-06-01"),
        cycleEnd: new Date("2027-05-31"),
        totalHours: 96,
        usedHours: 0,
        pendingHours: 0,
        graceDeadline: new Date("2027-07-31"),
      },
    });

    // Previous cycle 2025 (kept for grace-period testing). Start fresh —
    // usedHours should be 0 by default so new/seeded accounts don't appear
    // to have burned 80h. Set manually in DB if you need the grace scenario.
    await prisma.leaveBalance.upsert({
      where: { employeeId_cycleYear: { employeeId: emp.id, cycleYear: 2025 } },
      update: {},
      create: {
        employeeId: emp.id,
        cycleYear: 2025,
        cycleStart: new Date("2025-06-01"),
        cycleEnd: new Date("2026-05-31"),
        totalHours: 96,
        usedHours: 0,
        pendingHours: 0,
        graceDeadline: new Date("2026-07-31"),
      },
    });
  }

  // --- Holidays 2026 ---
  const holidays = [
    { date: new Date("2026-01-01"), name: "New Year", year: 2026 },
    { date: new Date("2026-04-30"), name: "Reunification Day", year: 2026 },
    { date: new Date("2026-05-01"), name: "Labor Day", year: 2026 },
    { date: new Date("2026-09-02"), name: "National Day", year: 2026 },
  ];

  for (const holiday of holidays) {
    await prisma.holiday.upsert({
      where: { date: holiday.date },
      update: {},
      create: holiday,
    });
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
