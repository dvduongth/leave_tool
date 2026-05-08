import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import {
  BASE_ANNUAL_LEAVE_HOURS,
  CYCLE_START_MONTH,
  CYCLE_START_DAY,
  GRACE_PERIOD_MONTHS,
  HIGH_OT_THRESHOLD_HOURS,
  LOW_BALANCE_THRESHOLD_HOURS,
  SENIORITY_BONUS_HOURS_PER_TIER,
  SENIORITY_YEARS_PER_TIER,
} from "../src/lib/constants";
import { totalAnnualLeaveHours } from "../src/lib/seniority";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface SeedEmployee {
  name: string;
  email: string;
  birthDate: string | null;
  phone: string | null;
  joinDate: string | null;
  gender: "FEMALE" | "MALE" | "UNSPECIFIED";
}

const ACTIVE_EMPLOYEES: SeedEmployee[] = [
  { name: "Đặng Thị Thơm", email: "dangthom@sgsa.jp", birthDate: "1989-07-02", phone: "0975531542", joinDate: "2016-04-01", gender: "FEMALE" },
  { name: "Phạm Linh Chi", email: "linhchi@sgsa.jp", birthDate: "1993-12-09", phone: "0345015568", joinDate: "2016-04-01", gender: "FEMALE" },
  { name: "Nguyễn Thu Thanh", email: "nguyenthuthanh@sgsa.jp", birthDate: "1990-06-26", phone: "0971325098", joinDate: "2016-04-10", gender: "FEMALE" },
  { name: "Chu Diệu Linh", email: "chudieulinh@sgsa.jp", birthDate: "1994-07-25", phone: "0986692094", joinDate: "2016-04-08", gender: "FEMALE" },
  { name: "Trương Diệu Linh", email: "truong_dieulinh@sgsa.jp", birthDate: "1994-10-31", phone: "0962147369", joinDate: "2016-11-04", gender: "FEMALE" },
  { name: "Phạm Quỳnh Trang", email: "quynhtrang@sgsa.jp", birthDate: "1991-10-20", phone: "0393077968", joinDate: "2016-12-04", gender: "FEMALE" },
  { name: "Nguyễn Văn Thành", email: "NguyenVanThanh@sgsa.jp", birthDate: "1996-09-11", phone: "0962195463", joinDate: "2017-06-10", gender: "MALE" },
  { name: "Phan Thị Mỹ Hạnh", email: "phanthimyhanh@sgsa.jp", birthDate: "1991-02-06", phone: "0989636039", joinDate: "2017-12-01", gender: "FEMALE" },
  { name: "Trần Thị Hồng", email: "tranthihong@sgsa.jp", birthDate: "1996-11-09", phone: "0389210783", joinDate: "2018-07-17", gender: "FEMALE" },
  { name: "Nguyễn Hồng Ngọc", email: "nguyenhongngoc@sgsa.jp", birthDate: "1994-10-29", phone: "0942746488", joinDate: "2018-08-17", gender: "FEMALE" },
  { name: "Vũ Thị Bích Ngọc", email: "vuthibichngoc@sgsa.jp", birthDate: "1991-12-08", phone: "0356101059", joinDate: "2018-10-01", gender: "FEMALE" },
  { name: "Nguyễn Thị Ngọc", email: "nguyenthingoc@sgsa.jp", birthDate: "1990-09-17", phone: "0986414602", joinDate: "2018-10-01", gender: "FEMALE" },
  { name: "Lại Thị Nhật", email: "laithinhat@sgsa.jp", birthDate: "1992-06-10", phone: "0377560762", joinDate: "2019-01-01", gender: "FEMALE" },
  { name: "Nguyễn Thị Minh Huệ", email: "nguyenthiminhhue@sgsa.jp", birthDate: "1993-05-02", phone: "0974020593", joinDate: "2019-01-01", gender: "FEMALE" },
  { name: "Đoàn Thị Thu Hòa", email: "doanthithuhoa@sgsa.jp", birthDate: "1995-05-18", phone: "0373640979", joinDate: "2019-01-01", gender: "FEMALE" },
  { name: "Phạm Thị Thúy", email: "phamthithuy@sgsa.jp", birthDate: "1998-02-24", phone: "0375752935", joinDate: "2019-06-01", gender: "FEMALE" },
  { name: "Đặng Thị Thanh Thúy", email: "dangthithanhthuy@sgsa.jp", birthDate: "1991-08-22", phone: null, joinDate: null, gender: "FEMALE" },
  { name: "Nguyễn Thị Quỳnh", email: "nguyenthiquynh@sgsa.jp", birthDate: "1995-09-03", phone: "0332859088", joinDate: "2020-10-01", gender: "FEMALE" },
  { name: "Trần Thị Ngọc Tú", email: "tranthingoctu@sgsa.jp", birthDate: "1990-08-21", phone: "0982976509", joinDate: "2021-07-01", gender: "FEMALE" },
];

const HOLIDAYS = [
  { date: "2026-01-01", name: "New Year", year: 2026 },
  { date: "2026-04-27", name: "Giỗ Tổ Hùng Vương", year: 2026 },
  { date: "2026-04-30", name: "Reunification Day", year: 2026 },
  { date: "2026-05-01", name: "Labor Day", year: 2026 },
  { date: "2026-09-02", name: "National Day", year: 2026 },
  { date: "2027-02-06", name: "Tết Âm lịch", year: 2026 },
];

function computeCurrentCycle(today: Date): { cycleYear: number; cycleStart: Date; cycleEnd: Date; graceDeadline: Date } {
  const y = today.getFullYear();
  const startThisYear = new Date(Date.UTC(y, CYCLE_START_MONTH - 1, CYCLE_START_DAY));
  const cycleYear = today >= startThisYear ? y : y - 1;
  const cycleStart = new Date(Date.UTC(cycleYear, CYCLE_START_MONTH - 1, CYCLE_START_DAY));
  const cycleEnd = new Date(Date.UTC(cycleYear + 1, CYCLE_START_MONTH - 1, CYCLE_START_DAY - 1));
  const graceDeadline = new Date(Date.UTC(cycleYear + 1, CYCLE_START_MONTH - 1 + GRACE_PERIOD_MONTHS, CYCLE_START_DAY - 1));
  return { cycleYear, cycleStart, cycleEnd, graceDeadline };
}

async function main() {
  console.log("🌱 Starting seed...");

  const today = new Date();
  const { cycleYear, cycleStart, cycleEnd, graceDeadline } = computeCurrentCycle(today);
  console.log(`Current cycle: ${cycleYear} (${cycleStart.toISOString().slice(0, 10)} → ${cycleEnd.toISOString().slice(0, 10)}, grace ${graceDeadline.toISOString().slice(0, 10)})`);

  // --- AppConfig ---
  const configs: Array<{ key: string; value: string; type: string; description: string }> = [
    { key: "BASE_ANNUAL_LEAVE_HOURS", value: String(BASE_ANNUAL_LEAVE_HOURS), type: "int", description: "Số giờ phép gốc mỗi cycle" },
    { key: "SENIORITY_BONUS_HOURS_PER_TIER", value: String(SENIORITY_BONUS_HOURS_PER_TIER), type: "int", description: "Giờ thưởng thâm niên mỗi tier" },
    { key: "SENIORITY_YEARS_PER_TIER", value: String(SENIORITY_YEARS_PER_TIER), type: "int", description: "Số năm cho 1 tier thâm niên" },
    { key: "LOW_BALANCE_THRESHOLD_HOURS", value: String(LOW_BALANCE_THRESHOLD_HOURS), type: "int", description: "Ngưỡng cảnh báo phép thấp" },
    { key: "GRACE_PERIOD_MONTHS", value: String(GRACE_PERIOD_MONTHS), type: "int", description: "Số tháng grace sau cycle" },
    { key: "CYCLE_START_MONTH", value: String(CYCLE_START_MONTH), type: "int", description: "Tháng bắt đầu cycle" },
    { key: "HIGH_OT_THRESHOLD_HOURS", value: String(HIGH_OT_THRESHOLD_HOURS), type: "int", description: "Ngưỡng cảnh báo OT cao (giờ/tháng)" },
    { key: "MENSTRUAL_LEAVE_DURATION_MINUTES", value: "30", type: "int", description: "Thời lượng nghỉ kinh nguyệt mỗi lần (phút)" },
    { key: "MENSTRUAL_LEAVE_MAX_DAYS_PER_MONTH", value: "3", type: "int", description: "Số ngày tối đa nghỉ kinh nguyệt mỗi tháng" },
    { key: "MATERNITY_LEAVE_DURATION_MINUTES", value: "60", type: "int", description: "Thời lượng nghỉ thai sản mỗi ngày (phút)" },
    { key: "MATERNITY_CHILD_AGE_LIMIT_MONTHS", value: "12", type: "int", description: "Tuổi tối đa của con để mẹ được hưởng chế độ thai sản (tháng)" },
    { key: "OT_CYCLE_START_MONTH", value: String(CYCLE_START_MONTH), type: "int", description: "Tháng bắt đầu cycle OT bank" },
    { key: "OT_GRACE_MONTHS", value: String(GRACE_PERIOD_MONTHS), type: "int", description: "Số tháng grace sau cycleEnd OT bank" },
  ];
  for (const c of configs) {
    await prisma.appConfig.upsert({ where: { key: c.key }, update: {}, create: c });
  }
  console.log(`✓ Seeded ${configs.length} app configs`);

  // --- Department ---
  const sgsa = await prisma.department.upsert({
    where: { id: "dept-sgsa" },
    update: { name: "SGSA" },
    create: { id: "dept-sgsa", name: "SGSA" },
  });
  console.log(`✓ Department: ${sgsa.name}`);

  // --- Admin ---
  const adminPwd = await bcrypt.hash("191091", 10);
  const admin = await prisma.employee.upsert({
    where: { email: "hachiko@sgsa.jp" },
    update: {},
    create: {
      name: "Hachiko Admin",
      email: "hachiko@sgsa.jp",
      password: adminPwd,
      role: "ADMIN",
      workShift: "A",
      departmentId: sgsa.id,
      gender: "UNSPECIFIED",
      mustChangePassword: true,
    },
  });
  console.log(`✓ Admin: ${admin.email}`);

  // --- 19 Employees ---
  const empPwd = await bcrypt.hash("12345678", 10);
  const employees = [];
  for (const e of ACTIVE_EMPLOYEES) {
    const emp = await prisma.employee.upsert({
      where: { email: e.email },
      update: {},
      create: {
        name: e.name,
        email: e.email,
        password: empPwd,
        role: "EMPLOYEE",
        workShift: "A",
        departmentId: sgsa.id,
        managerId: admin.id,
        gender: e.gender,
        birthDate: e.birthDate ? new Date(e.birthDate) : null,
        joinDate: e.joinDate ? new Date(e.joinDate) : null,
        phone: e.phone,
        mustChangePassword: true,
      },
    });
    employees.push(emp);
  }
  console.log(`✓ Seeded ${employees.length} employees`);

  // --- Holidays ---
  for (const h of HOLIDAYS) {
    await prisma.holiday.upsert({
      where: { date: new Date(h.date) },
      update: {},
      create: { date: new Date(h.date), name: h.name, year: h.year },
    });
  }
  console.log(`✓ Seeded ${HOLIDAYS.length} holidays`);

  // --- EmployeeWeekShift (5 rows × 20 people = 100 rows) ---
  const allPeople = [admin, ...employees];
  const effectiveDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  let weekShiftCount = 0;
  for (const p of allPeople) {
    for (let d = 1; d <= 5; d++) {
      await prisma.employeeWeekShift.upsert({
        where: {
          employeeId_dayOfWeek_effectiveDate: {
            employeeId: p.id,
            dayOfWeek: d,
            effectiveDate,
          },
        },
        update: {},
        create: {
          employeeId: p.id,
          dayOfWeek: d,
          shiftType: p.workShift,
          effectiveDate,
        },
      });
      weekShiftCount++;
    }
  }
  console.log(`✓ Seeded ${weekShiftCount} EmployeeWeekShift rows`);

  // --- LeaveBalance for current cycle ---
  let leaveBalCount = 0;
  for (const p of allPeople) {
    const totalHours = totalAnnualLeaveHours(p.joinDate, today);
    await prisma.leaveBalance.upsert({
      where: { employeeId_cycleYear: { employeeId: p.id, cycleYear } },
      update: {},
      create: {
        employeeId: p.id,
        cycleYear,
        cycleStart,
        cycleEnd,
        graceDeadline,
        totalHours,
        usedHours: 0,
        pendingHours: 0,
      },
    });
    leaveBalCount++;
  }
  console.log(`✓ Seeded ${leaveBalCount} LeaveBalance rows for cycle ${cycleYear}`);

  // --- OTBalance for current cycle (totalMinutes=0, accrue when OT approved) ---
  let otBalCount = 0;
  for (const p of allPeople) {
    await prisma.oTBalance.upsert({
      where: { employeeId_cycleYear: { employeeId: p.id, cycleYear } },
      update: {},
      create: {
        employeeId: p.id,
        cycleYear,
        cycleStart,
        cycleEnd,
        graceDeadline,
        totalMinutes: 0,
        usedMinutes: 0,
        pendingMinutes: 0,
      },
    });
    otBalCount++;
  }
  console.log(`✓ Seeded ${otBalCount} OTBalance rows for cycle ${cycleYear}`);

  console.log("✅ Seed completed");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
