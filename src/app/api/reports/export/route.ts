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
import { messages, translate, type Messages } from "@/lib/i18n";
import { resolveLocale } from "@/lib/i18n/server";

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

type T = (key: string) => string;

function buildDailyCsv(d: DailyReport, t: T): string {
  const lines: string[] = [];
  lines.push(csvRow([t("reports.csvDailyTitle"), d.date]));
  lines.push("");
  lines.push(csvRow([t("reports.csvSummary")]));
  lines.push(csvRow([t("reports.totalOnLeave"), d.summary.totalOnLeave]));
  lines.push(csvRow([t("reports.totalOT"), d.summary.totalOtMinutes]));
  lines.push("");
  lines.push(csvRow([t("reports.employeesOnLeave")]));
  lines.push(
    csvRow([
      t("reports.csvEmployeeId"),
      t("reports.colEmployee"),
      t("reports.colLeaveHours"),
      t("reports.colStatus"),
    ])
  );
  for (const e of d.employees) {
    lines.push(csvRow([e.id, e.name, e.totalHours, e.status]));
  }
  lines.push("");
  lines.push(csvRow([t("reports.otRecords")]));
  lines.push(
    csvRow([
      t("reports.csvEmployeeId"),
      t("reports.colEmployee"),
      t("reports.colOtMinutes"),
    ])
  );
  for (const r of d.otRecords) {
    lines.push(csvRow([r.id, r.name, r.otMinutes]));
  }
  return lines.join("\r\n");
}

function buildWeeklyCsv(d: WeeklyReport, t: T): string {
  const lines: string[] = [];
  lines.push(csvRow([t("reports.csvWeeklyTitle"), d.weekStart, d.weekEnd]));
  lines.push("");
  lines.push(csvRow([t("reports.csvSummary")]));
  lines.push(csvRow([t("reports.totalLeave"), d.summary.totalLeaveHours]));
  lines.push(csvRow([t("reports.totalOT"), d.summary.totalOtMinutes]));
  lines.push(csvRow([t("reports.csvApprovedCount"), d.summary.approvedCount]));
  lines.push(csvRow([t("reports.csvRejectedCount"), d.summary.rejectedCount]));
  lines.push(csvRow([t("reports.csvApprovalRatePct"), d.summary.approvalRate]));
  lines.push("");
  lines.push(csvRow([t("reports.leaveByDay")]));
  lines.push(csvRow([t("reports.csvDay"), t("reports.csvHours")]));
  for (const row of d.dayOfWeekHours) {
    lines.push(csvRow([row.day, row.hours]));
  }
  lines.push("");
  lines.push(csvRow([t("reports.employeeBreakdown")]));
  lines.push(
    csvRow([
      t("reports.csvEmployeeId"),
      t("reports.colEmployee"),
      t("reports.colThisWeek"),
      t("reports.colLastWeek"),
      t("reports.colDelta"),
      t("reports.colOtMin"),
    ])
  );
  for (const e of d.employees) {
    lines.push(
      csvRow([e.id, e.name, e.thisWeekHours, e.prevWeekHours, e.delta, e.otMinutes])
    );
  }
  return lines.join("\r\n");
}

function buildMonthlyCsv(d: MonthlyReport, t: T): string {
  const lines: string[] = [];
  lines.push(csvRow([t("reports.csvMonthlyTitle"), d.monthStart, d.monthEnd]));
  lines.push("");
  lines.push(csvRow([t("reports.departmentSummary")]));
  lines.push(
    csvRow([
      t("reports.csvDepartmentId"),
      t("reports.colDepartment"),
      t("reports.colEmployees"),
      t("reports.colLeaveHours"),
      t("reports.colOtHours"),
      t("reports.colUtilization"),
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
  lines.push(csvRow([t("reports.topLeaveTakers")]));
  lines.push(
    csvRow([
      t("reports.csvRank"),
      t("reports.csvEmployeeId"),
      t("reports.colEmployee"),
      t("reports.csvHours"),
    ])
  );
  d.topLeaveTakers.forEach((emp, i) => {
    lines.push(csvRow([i + 1, emp.id, emp.name, emp.hours]));
  });
  lines.push("");
  lines.push(csvRow([t("reports.csvUncompensatedByDept")]));
  lines.push(
    csvRow([
      t("reports.csvDepartmentId"),
      t("reports.colDepartment"),
      t("reports.colTotalDeficit"),
      t("reports.colTotalMakeup"),
      t("reports.colEmployeesRemaining"),
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

function buildCsv(report: AnyReport, t: T): string {
  if (report.type === "daily") return buildDailyCsv(report, t);
  if (report.type === "weekly") return buildWeeklyCsv(report, t);
  return buildMonthlyCsv(report, t);
}

function defaultFilename(type: string, date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `leave-report-${type}-${yyyy}${mm}${dd}.csv`;
}

// Sanitize a user-supplied filename: strip path separators, control chars,
// and characters disallowed on Windows. Ensure .csv extension. Length cap.
function sanitizeFilename(raw: string, fallback: string): string {
  // Strip path components (anything after the last / or \)
  const base = raw.replace(/^.*[\\/]/, "").trim();
  if (!base) return fallback;
  // Replace forbidden Windows chars and control chars with _
  // eslint-disable-next-line no-control-regex
  let cleaned = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  // Avoid trailing dots/spaces (Windows)
  cleaned = cleaned.replace(/[. ]+$/, "");
  if (!cleaned) return fallback;
  // Force .csv extension
  if (!/\.csv$/i.test(cleaned)) cleaned += ".csv";
  // Hard cap
  if (cleaned.length > 200) cleaned = cleaned.slice(0, 196) + ".csv";
  return cleaned;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const locale = await resolveLocale();
    const msgs: Messages = messages[locale];
    const t: T = (key: string) => translate(msgs, key);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "daily";
    const dateStr = searchParams.get("date");
    const departmentId = searchParams.get("departmentId");
    const requestedFilename = searchParams.get("filename");

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
    const csv = "\uFEFF" + buildCsv(report, t);
    const fallback = defaultFilename(type, queryDate);
    const filename = requestedFilename
      ? sanitizeFilename(requestedFilename, fallback)
      : fallback;

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
