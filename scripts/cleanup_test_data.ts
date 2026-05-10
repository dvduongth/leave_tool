import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Cleaning test data — keeping employees + holidays + configs + departments");

  // 1) Drop all transactional rows
  // Order matters: rows that reference others must go first
  const consumed = await prisma.leaveOTConsumption.deleteMany({});
  console.log(`  - LeaveOTConsumption: ${consumed.count} rows`);

  const history = await prisma.leaveRequestHistory.deleteMany({});
  console.log(`  - LeaveRequestHistory: ${history.count} rows`);

  const leaves = await prisma.leaveRequest.deleteMany({});
  console.log(`  - LeaveRequest: ${leaves.count} rows`);

  const otRecords = await prisma.oTRecord.deleteMany({});
  console.log(`  - OTRecord: ${otRecords.count} rows`);

  const flexRecords = await prisma.flexTimeRecord.deleteMany({});
  console.log(`  - FlexTimeRecord: ${flexRecords.count} rows`);

  const flexSummaries = await prisma.flexTimeMonthlySummary.deleteMany({});
  console.log(`  - FlexTimeMonthlySummary: ${flexSummaries.count} rows`);

  const maternityLeaves = await prisma.maternityLeave.deleteMany({});
  console.log(`  - MaternityLeave: ${maternityLeaves.count} rows`);

  const children = await prisma.employeeChild.deleteMany({});
  console.log(`  - EmployeeChild: ${children.count} rows`);

  const shiftReqs = await prisma.shiftChangeRequest.deleteMany({});
  console.log(`  - ShiftChangeRequest: ${shiftReqs.count} rows`);

  const menstrual = await prisma.menstrualLeave.deleteMany({});
  console.log(`  - MenstrualLeave: ${menstrual.count} rows`);

  const audits = await prisma.auditLog.deleteMany({});
  console.log(`  - AuditLog: ${audits.count} rows`);

  const notifs = await prisma.notification.deleteMany({});
  console.log(`  - Notification: ${notifs.count} rows`);

  // 2) Reset balances to zero usage (keep the row for the cycle)
  const lbReset = await prisma.leaveBalance.updateMany({
    data: { usedHours: 0, pendingHours: 0 },
  });
  console.log(`  - LeaveBalance reset (used=0, pending=0): ${lbReset.count} rows`);

  const otBalReset = await prisma.oTBalance.updateMany({
    data: { totalMinutes: 0, usedMinutes: 0, pendingMinutes: 0 },
  });
  console.log(`  - OTBalance reset (total=0, used=0, pending=0): ${otBalReset.count} rows`);

  // 3) Collapse EmployeeWeekShift history → single row per (employee, dayOfWeek)
  // Keep workShift on Employee as the canonical source. Wipe all rows + reseed
  // with effectiveDate = today.
  const wipedShifts = await prisma.employeeWeekShift.deleteMany({});
  console.log(`  - EmployeeWeekShift wiped: ${wipedShifts.count} rows`);

  const today = new Date();
  const effectiveDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, workShift: true },
  });
  let reseeded = 0;
  for (const emp of employees) {
    for (let d = 1; d <= 5; d++) {
      await prisma.employeeWeekShift.create({
        data: {
          employeeId: emp.id,
          dayOfWeek: d,
          shiftType: emp.workShift,
          effectiveDate,
        },
      });
      reseeded++;
    }
  }
  console.log(`  - EmployeeWeekShift reseeded: ${reseeded} rows (5 days × ${employees.length} employees)`);

  // 4) Reset mustChangePassword=true for everyone (force re-onboarding)
  const pwReset = await prisma.employee.updateMany({
    data: { mustChangePassword: true },
  });
  console.log(`  - mustChangePassword reset: ${pwReset.count} employees`);

  console.log("\n✅ Cleanup complete. Employees + holidays + AppConfig untouched.");
  console.log(`   ${employees.length} active employees ready for fresh use.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
