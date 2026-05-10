import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { spawnSync } from "child_process";
import { totalAnnualLeaveHours } from "../src/lib/seniority";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface XlsxEmployee {
  name: string;
  email: string;
  birthDate: string | null;
  phone: string | null;
  joinDate: string | null;
  rawRole: string; // "" | "MANAGER" | "Giám Đốc"
}

function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function readXlsxViaPython(): XlsxEmployee[] {
  const py = `
import json, sys
from openpyxl import load_workbook
sys.stdout.reconfigure(encoding='utf-8')
wb = load_workbook('D:/info.xlsx')
ws = wb['TTNV']
out = []

def parse_date(v):
    if v is None: return None
    if hasattr(v, 'strftime'): return v.strftime('%Y-%m-%d')
    s = str(v).strip()
    import re
    m = re.match(r'^(\\d{1,2})/(\\d{1,2})/(\\d{4})$', s)
    if m:
        d, mo, y = m.groups()
        return f'{y}-{int(mo):02d}-{int(d):02d}'
    return None

# Final list: take ALL rows with a name, regardless of fill color or role.
for r in range(2, ws.max_row+1):
    name = ws.cell(r, 2).value
    if not name or not str(name).strip(): continue
    role_cell = ws.cell(r, 4).value
    role = role_cell if isinstance(role_cell, str) and not role_cell.startswith('=') else ''
    ngay_vao = ws.cell(r, 10).value
    email = ws.cell(r, 13).value
    bday = ws.cell(r, 3).value
    phone = ws.cell(r, 11).value
    out.append({
        'name': str(name).strip(),
        'rawRole': role.strip(),
        'joinDate': parse_date(ngay_vao),
        'birthDate': parse_date(bday),
        'phone': str(phone).replace(' ','') if phone else None,
        'email': email,
    })
print(json.dumps(out, ensure_ascii=False))
`;
  const res = spawnSync("python", ["-c", py], { encoding: "utf-8" });
  if (res.status !== 0) {
    throw new Error(`Python failed: ${res.stderr}`);
  }
  const list = JSON.parse(res.stdout) as Array<Omit<XlsxEmployee, "email"> & { email: string | null }>;
  return list.map((e) => ({
    ...e,
    email: e.email && typeof e.email === "string" ? e.email : `${slug(e.name)}@sgsa.jp`,
  }));
}

function mapRole(rawRole: string): "EMPLOYEE" | "MANAGER" | "HEAD" | "ADMIN" {
  const t = rawRole.trim().toLowerCase();
  if (t === "admin" || t.includes("giám đốc") || t.includes("giam doc")) return "ADMIN";
  if (t === "head") return "HEAD";
  if (t === "manager") return "MANAGER";
  return "EMPLOYEE";
}

async function main() {
  const xlsxList = readXlsxViaPython();
  console.log(`Read ${xlsxList.length} active employees from xlsx`);

  // Identify Director (highest role: ADMIN > HEAD). All other employees report
  // to the Director. If both ADMIN and HEAD exist, HEAD reports to ADMIN.
  const adminFromXlsx = xlsxList.find((e) => mapRole(e.rawRole) === "ADMIN");
  const headFromXlsx = xlsxList.find((e) => mapRole(e.rawRole) === "HEAD");
  const director = adminFromXlsx ?? headFromXlsx;
  if (!director) throw new Error("No ADMIN/HEAD found in xlsx");
  console.log(`Director: ${director.name} <${director.email}> (${mapRole(director.rawRole)})`);

  const dept = await prisma.department.findFirstOrThrow();
  const empPwd = await bcrypt.hash("12345678", 10);

  // Pass: insert ADMIN first, then HEAD (manager=ADMIN), then MANAGER+EMPLOYEE
  // (manager=Director). This avoids FK ordering issues.
  const orderedList = [
    ...xlsxList.filter((e) => mapRole(e.rawRole) === "ADMIN"),
    ...xlsxList.filter((e) => mapRole(e.rawRole) === "HEAD"),
    ...xlsxList.filter((e) => mapRole(e.rawRole) === "MANAGER"),
    ...xlsxList.filter((e) => mapRole(e.rawRole) === "EMPLOYEE"),
  ];

  let directorRecord: { id: string } | null = null;
  let adminRecord: { id: string } | null = null;
  for (const e of orderedList) {
    const role = mapRole(e.rawRole);
    let managerId: string | null = null;
    if (role === "ADMIN") {
      managerId = null; // top of the tree
    } else if (role === "HEAD") {
      managerId = adminRecord?.id ?? null;
    } else {
      managerId = directorRecord?.id ?? adminRecord?.id ?? null;
    }
    const isDirector = role === "ADMIN" || (role === "HEAD" && !adminRecord);

    const updated: { id: string } = await prisma.employee.upsert({
      where: { email: e.email },
      update: {
        name: e.name,
        role,
        managerId,
        joinDate: e.joinDate ? new Date(e.joinDate) : null,
        birthDate: e.birthDate ? new Date(e.birthDate) : null,
        phone: e.phone,
      },
      create: {
        name: e.name,
        email: e.email,
        password: empPwd,
        role,
        workShift: "A",
        departmentId: dept.id,
        managerId,
        gender: "FEMALE",
        birthDate: e.birthDate ? new Date(e.birthDate) : null,
        joinDate: e.joinDate ? new Date(e.joinDate) : null,
        phone: e.phone,
        mustChangePassword: true,
      },
    });
    if (role === "ADMIN") adminRecord = updated;
    if (isDirector) directorRecord = updated;
    const mgrLabel = !managerId
      ? "—"
      : managerId === adminRecord?.id
      ? "Admin"
      : "Director";
    console.log(
      `  ${role.padEnd(8)} ${e.name.padEnd(28)} mgr=${mgrLabel} join=${e.joinDate ?? "—"} email=${e.email}`
    );
  }

  if (!directorRecord) throw new Error("Director upsert returned null");

  // Department head: prefer xlsx HEAD; fall back to Director
  const deptHead = headFromXlsx
    ? await prisma.employee.findUnique({ where: { email: headFromXlsx.email } })
    : null;
  const deptHeadId = deptHead?.id ?? directorRecord.id;
  await prisma.department.update({
    where: { id: dept.id },
    data: { headId: deptHeadId },
  });
  console.log(`✓ Department head set to ${deptHead?.name ?? director.name}`);

  // Step 3: identify employees in DB but NOT in xlsx list → delete (cascade)
  // Final list = xlsx only. Any employee not in xlsx (including hachiko system
  // admin) will be removed.
  const xlsxEmails = new Set(xlsxList.map((e) => e.email.toLowerCase()));
  const dbEmployees = await prisma.employee.findMany({
    select: { id: true, name: true, email: true, role: true },
  });
  const toRemove = dbEmployees.filter((d) => !xlsxEmails.has(d.email.toLowerCase()));

  if (toRemove.length > 0) {
    console.log(`\nRemoving ${toRemove.length} employees no longer in active list:`);
    for (const r of toRemove) {
      console.log(`  - ${r.name} <${r.email}>`);
      try {
        await prisma.employee.delete({ where: { id: r.id } });
      } catch (err) {
        console.error(`    ✗ delete failed:`, err instanceof Error ? err.message : err);
      }
    }
  } else {
    console.log(`\nNo employees to remove`);
  }

  // Step 4: ensure LeaveBalance + OTBalance + EmployeeWeekShift exist for all
  // current employees (defensive — covers any newly-created ones)
  const today = new Date();
  const cycleYear = today.getMonth() + 1 >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  const cycleStart = new Date(Date.UTC(cycleYear, 5, 1));
  const cycleEnd = new Date(Date.UTC(cycleYear + 1, 4, 31));
  const graceDeadline = new Date(Date.UTC(cycleYear + 1, 6, 31));

  const allActive = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, joinDate: true, workShift: true },
  });
  let leaveBalCreated = 0,
    otBalCreated = 0,
    weekShiftCreated = 0;
  for (const emp of allActive) {
    const totalHours = totalAnnualLeaveHours(emp.joinDate, today);
    const lb = await prisma.leaveBalance.upsert({
      where: { employeeId_cycleYear: { employeeId: emp.id, cycleYear } },
      update: { totalHours },
      create: { employeeId: emp.id, cycleYear, cycleStart, cycleEnd, graceDeadline, totalHours },
    });
    if (lb.usedHours === 0 && lb.totalHours === totalHours) leaveBalCreated++;

    await prisma.oTBalance.upsert({
      where: { employeeId_cycleYear: { employeeId: emp.id, cycleYear } },
      update: {},
      create: { employeeId: emp.id, cycleYear, cycleStart, cycleEnd, graceDeadline },
    });
    otBalCreated++;

    const effectiveDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    for (let d = 1; d <= 5; d++) {
      await prisma.employeeWeekShift.upsert({
        where: { employeeId_dayOfWeek_effectiveDate: { employeeId: emp.id, dayOfWeek: d, effectiveDate } },
        update: {},
        create: { employeeId: emp.id, dayOfWeek: d, shiftType: emp.workShift, effectiveDate },
      });
      weekShiftCreated++;
    }
  }
  console.log(`\n✓ ${allActive.length} active employees synced`);
  console.log(`  LeaveBalance refresh: ${leaveBalCreated}`);
  console.log(`  OTBalance ensure:     ${otBalCreated}`);
  console.log(`  EmployeeWeekShift:    ${weekShiftCreated}`);

  // Step 5: summary
  const summary = await prisma.employee.groupBy({
    by: ["role"],
    _count: { id: true },
  });
  console.log(`\n=== Final role distribution ===`);
  for (const s of summary) console.log(`  ${s.role}: ${s._count.id}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
