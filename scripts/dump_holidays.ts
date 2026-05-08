import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
async function main() {
  const holidays = await prisma.holiday.findMany({ orderBy: { date: 'asc' } });
  console.log('Holidays count:', holidays.length);
  for (const h of holidays) {
    console.log(h.date.toISOString().slice(0,10), '|', h.name, '| year:', h.year);
  }
  const empCount = await prisma.employee.count();
  const deptCount = await prisma.department.count();
  console.log('---');
  console.log('Employees:', empCount, 'Departments:', deptCount);
  await prisma.$disconnect();
}
main();
