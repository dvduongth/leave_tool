import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const emp = await prisma.employee.findUnique({
    where: { email: "dangthom@sgsa.jp" },
    select: { id: true, name: true, workShift: true },
  });
  if (!emp) {
    console.log("Employee not found");
    process.exit(1);
  }
  console.log("Employee:", emp);

  const rows = await prisma.employeeWeekShift.findMany({
    where: { employeeId: emp.id },
    orderBy: [{ dayOfWeek: "asc" }, { effectiveDate: "asc" }],
  });
  console.log("\nEmployeeWeekShift rows for", emp.name, ":");
  for (const r of rows) {
    console.log(
      `  dow=${r.dayOfWeek}  shift=${r.shiftType}  effective=${r.effectiveDate.toISOString().slice(0, 10)}  endDate=${r.endDate?.toISOString().slice(0, 10) ?? "null"}`
    );
  }

  const reqs = await prisma.shiftChangeRequest.findMany({
    where: { employeeId: emp.id },
    orderBy: { createdAt: "desc" },
  });
  console.log("\nShiftChangeRequests:");
  for (const r of reqs) {
    console.log(
      `  ${r.id.slice(0, 8)}  status=${r.status}  effective=${r.effectiveDate.toISOString().slice(0, 10)}  approvedBy=${r.approvedBy?.slice(0, 8) ?? "null"}`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
