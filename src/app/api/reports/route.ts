import { getCurrentUser } from "@/lib/auth-utils";
import {
  getDailyReport,
  getMonthlyReport,
  getVisibleEmployeeIds,
  getWeeklyReport,
} from "@/lib/reports";
import { logAudit, getRequestIp } from "@/lib/audit";

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

    let payload: unknown;
    if (type === "daily") {
      payload = await getDailyReport(queryDate, employeeFilter);
    } else if (type === "weekly") {
      payload = await getWeeklyReport(queryDate, employeeFilter);
    } else if (type === "monthly") {
      payload = await getMonthlyReport(queryDate, employeeFilter, user.role);
    } else {
      return Response.json({ error: "Invalid report type" }, { status: 400 });
    }

    await logAudit({
      userId: user.id,
      action: "REPORT_VIEW",
      entity: "report",
      metadata: {
        type,
        date: queryDate.toISOString().slice(0, 10),
        departmentId: departmentId || null,
        role: user.role,
        visibleEmployeeCount: employeeIds?.length ?? null,
      },
      ipAddress: getRequestIp(request),
    });

    return Response.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
