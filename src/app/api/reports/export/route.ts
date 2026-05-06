import { getCurrentUser } from "@/lib/auth-utils";
import {
  AnyReport,
  DailyReport,
  MonthlyReport,
  WeeklyReport,
  getDailyReport,
  getMonthlyReport,
  getVisibleEmployeeIds,
  getWeeklyReport,
} from "@/lib/reports";

// RFC 4180 CSV escape: wrap in quotes if the value contains a comma,
// double-quote, CR, or LF. Inner quotes are doubled.
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

function buildDailyCsv(d: DailyReport): string {
  const lines: string[] = [];
  lines.push(csvRow(["Daily Report", d.date]));
  lines.push("");
  lines.push(csvRow(["Summary"]));
  lines.push(csvRow(["Total on leave", d.summary.totalOnLeave]));
  lines.push(csvRow(["Total OT minutes", d.summary.totalOtMinutes]));
  lines.push("");
  lines.push(csvRow(["Employees on Leave"]));
  lines.push(csvRow(["Employee ID", "Employee", "Leave Hours", "Status"]));
  for (const e of d.employees) {
    lines.push(csvRow([e.id, e.name, e.totalHours, e.status]));
  }
  lines.push("");
  lines.push(csvRow(["OT Records"]));
  lines.push(csvRow(["Employee ID", "Employee", "OT Minutes"]));
  for (const r of d.otRecords) {
    lines.push(csvRow([r.id, r.name, r.otMinutes]));
  }
  return lines.join("\r\n");
}

function buildWeeklyCsv(d: WeeklyReport): string {
  const lines: string[] = [];
  lines.push(csvRow(["Weekly Report", d.weekStart, d.weekEnd]));
  lines.push("");
  lines.push(csvRow(["Summary"]));
  lines.push(csvRow(["Total leave hours", d.summary.totalLeaveHours]));
  lines.push(csvRow(["Total OT minutes", d.summary.totalOtMinutes]));
  lines.push(csvRow(["Approved count", d.summary.approvedCount]));
  lines.push(csvRow(["Rejected count", d.summary.rejectedCount]));
  lines.push(csvRow(["Approval rate (%)", d.summary.approvalRate]));
  lines.push("");
  lines.push(csvRow(["Leave Hours by Day of Week"]));
  lines.push(csvRow(["Day", "Hours"]));
  for (const row of d.dayOfWeekHours) {
    lines.push(csvRow([row.day, row.hours]));
  }
  lines.push("");
  lines.push(csvRow(["Employee Breakdown"]));
  lines.push(
    csvRow([
      "Employee ID",
      "Employee",
      "This Week (h)",
      "Last Week (h)",
      "Delta (h)",
      "OT (min)",
    ])
  );
  for (const e of d.employees) {
    lines.push(
      csvRow([e.id, e.name, e.thisWeekHours, e.prevWeekHours, e.delta, e.otMinutes])
    );
  }
  return lines.join("\r\n");
}

function buildMonthlyCsv(d: MonthlyReport): string {
  const lines: string[] = [];
  lines.push(csvRow(["Monthly Report", d.monthStart, d.monthEnd]));
  lines.push("");
  lines.push(csvRow(["Department Summary"]));
  lines.push(
    csvRow([
      "Department ID",
      "Department",
      "Employees",
      "Leave Hours",
      "OT Hours",
      "Utilization (%)",
    ])
  );
  for (const dept of d.departments) {
    lines.push(
      csvRow([
        dept.departmentId,
        dept.departmentName,
        dept.employeeCount,
        dept.totalLeaveHours,
        Math.round((dept.totalOtMinutes / 60) * 10) / 10,
        dept.utilizationRate,
      ])
    );
  }
  lines.push("");
  lines.push(csvRow(["Top Leave Takers"]));
  lines.push(csvRow(["Rank", "Employee ID", "Employee", "Hours"]));
  d.topLeaveTakers.forEach((emp, i) => {
    lines.push(csvRow([i + 1, emp.id, emp.name, emp.hours]));
  });
  lines.push("");
  lines.push(csvRow(["Uncompensated Flex Deficit (by Department)"]));
  lines.push(
    csvRow([
      "Department ID",
      "Department",
      "Total Deficit (min)",
      "Total Makeup (min)",
      "Employees Remaining",
    ])
  );
  for (const dept of d.departments.filter(
    (x) => x.flex.employeesWithRemaining > 0
  )) {
    lines.push(
      csvRow([
        dept.departmentId,
        dept.departmentName,
        dept.flex.totalDeficit,
        dept.flex.totalMakeup,
        dept.flex.employeesWithRemaining,
      ])
    );
  }
  return lines.join("\r\n");
}

function buildCsv(report: AnyReport): string {
  if (report.type === "daily") return buildDailyCsv(report);
  if (report.type === "weekly") return buildWeeklyCsv(report);
  return buildMonthlyCsv(report);
}

function buildFilename(type: string, date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `leave-report-${type}-${yyyy}${mm}${dd}.csv`;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "daily";
    const dateStr = searchParams.get("date");
    const departmentId = searchParams.get("departmentId");

    const queryDate = dateStr ? new Date(dateStr) : new Date();
    queryDate.setHours(0, 0, 0, 0);

    const employeeIds = await getVisibleEmployeeIds(user, departmentId);
    const employeeFilter = employeeIds
      ? { employeeId: { in: employeeIds } }
      : {};

    let report: AnyReport;
    if (type === "daily") {
      report = await getDailyReport(queryDate, employeeFilter);
    } else if (type === "weekly") {
      report = await getWeeklyReport(queryDate, employeeFilter);
    } else if (type === "monthly") {
      report = await getMonthlyReport(queryDate, employeeFilter, user.role);
    } else {
      return Response.json({ error: "Invalid report type" }, { status: 400 });
    }

    // UTF-8 BOM so Excel on Windows picks up UTF-8 (preserves Vietnamese/Japanese)
    const csv = "\uFEFF" + buildCsv(report);
    const filename = buildFilename(type, queryDate);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
