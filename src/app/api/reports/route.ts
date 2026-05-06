import { getCurrentUser } from "@/lib/auth-utils";
import {
  getDailyReport,
  getMonthlyReport,
  getVisibleEmployeeIds,
  getWeeklyReport,
} from "@/lib/reports";

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

    if (type === "daily") {
      return Response.json(await getDailyReport(queryDate, employeeFilter));
    }

    if (type === "weekly") {
      return Response.json(await getWeeklyReport(queryDate, employeeFilter));
    }

    if (type === "monthly") {
      return Response.json(
        await getMonthlyReport(queryDate, employeeFilter, user.role)
      );
    }

    return Response.json({ error: "Invalid report type" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
