import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const headerSecret = request.headers.get("authorization")?.replace("Bearer ", "");
  const querySecret = request.nextUrl.searchParams.get("secret");

  return headerSecret === secret || querySecret === secret;
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Current month YYYY-MM
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Find all OPEN summaries for current month with remaining > 0
    const summaries = await prisma.flexTimeMonthlySummary.findMany({
      where: {
        yearMonth,
        status: "OPEN",
        remaining: { gt: 0 },
      },
      include: {
        employee: { select: { id: true, name: true } },
      },
    });

    let warningsSent = 0;

    for (const summary of summaries) {
      await createNotification(
        summary.employeeId,
        "Flex Time Reminder",
        `You have ${summary.remaining} minutes of flex time deficit remaining for ${yearMonth}. Please make up the time before month-end to avoid automatic leave deduction.`,
        "/flex-time"
      );
      warningsSent++;
    }

    return Response.json({
      yearMonth,
      warningsSent,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
