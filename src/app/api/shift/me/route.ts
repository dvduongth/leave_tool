import { EMPLOYEE_REMOVED, requireValidEmployee } from "@/lib/auth-utils";
import { loadShiftHistory, resolveShiftFromHistory } from "@/lib/working-hours";

export async function GET() {
  try {
    const user = await requireValidEmployee();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { history, fallback } = await loadShiftHistory(user.id);

    const weeklyShifts: Record<number, string> = {};
    for (let dow = 1; dow <= 5; dow++) {
      weeklyShifts[dow] = resolveShiftFromHistory(history, dow, today, fallback);
    }

    return Response.json({
      employeeId: user.id,
      asOf: today.toISOString().slice(0, 10),
      fallback,
      weeklyShifts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "Unauthorized") {
      return Response.json({ error: message }, { status: 401 });
    }
    if (message === EMPLOYEE_REMOVED) {
      return Response.json(
        { error: "Tài khoản không còn tồn tại. Vui lòng đăng nhập lại.", code: EMPLOYEE_REMOVED, forceLogout: true },
        { status: 401 }
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
