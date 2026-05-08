import { requireAuth } from "@/lib/auth-utils";
import { getActiveOTBalances } from "@/lib/ot-bank";

function serialize(b: {
  id: string;
  cycleYear: number;
  cycleStart: Date;
  cycleEnd: Date;
  graceDeadline: Date;
  totalMinutes: number;
  usedMinutes: number;
  pendingMinutes: number;
}) {
  return {
    id: b.id,
    cycleYear: b.cycleYear,
    cycleStart: b.cycleStart.toISOString().slice(0, 10),
    cycleEnd: b.cycleEnd.toISOString().slice(0, 10),
    graceDeadline: b.graceDeadline.toISOString().slice(0, 10),
    totalMinutes: b.totalMinutes,
    usedMinutes: b.usedMinutes,
    pendingMinutes: b.pendingMinutes,
    remainingMinutes: b.totalMinutes - b.usedMinutes - b.pendingMinutes,
  };
}

export async function GET() {
  try {
    const user = await requireAuth();
    const { current, grace, totalRemainingMinutes } = await getActiveOTBalances(user.id);
    return Response.json({
      current: serialize(current),
      grace: grace ? serialize(grace) : null,
      totalRemainingMinutes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized") {
      return Response.json({ error: message }, { status: 401 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
