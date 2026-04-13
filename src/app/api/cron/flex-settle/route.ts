import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { deductLeave } from "@/lib/leave-calculator";
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
    // Calculate previous month's YYYY-MM
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const yearMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

    // Get all OPEN summaries for the previous month
    const openSummaries = await prisma.flexTimeMonthlySummary.findMany({
      where: {
        yearMonth,
        status: "OPEN",
      },
      include: {
        employee: { select: { id: true, name: true } },
      },
    });

    const results: {
      settled: number;
      deducted: number;
      errors: string[];
    } = { settled: 0, deducted: 0, errors: [] };

    for (const summary of openSummaries) {
      try {
        if (summary.remaining > 0) {
          // Calculate auto-deduct hours: ceil(remaining / 15) * 0.25
          const autoDeductHours =
            Math.ceil(summary.remaining / 15) * 0.25;

          // Create auto-deduct LeaveRequest
          const today = new Date();
          await prisma.leaveRequest.create({
            data: {
              employeeId: summary.employeeId,
              startDate: today,
              startTime: "00:00",
              endDate: today,
              endTime: "00:00",
              totalHours: autoDeductHours,
              reason: `Auto-deduct for flex time deficit (${yearMonth}): ${summary.remaining} minutes remaining`,
              status: "APPROVED",
              isAutoDeduct: true,
              managerAction: "AUTO_APPROVED",
              managerActionAt: today,
            },
          });

          // Deduct from leave balance
          await deductLeave(summary.employeeId, autoDeductHours, today);

          // Update summary
          await prisma.flexTimeMonthlySummary.update({
            where: { id: summary.id },
            data: {
              autoDeductHours,
              status: "SETTLED",
              settledAt: today,
            },
          });

          // Notify employee
          await createNotification(
            summary.employeeId,
            "Flex Time Auto-Deduction",
            `Your flex time deficit of ${summary.remaining} minutes for ${yearMonth} has been auto-deducted as ${autoDeductHours} hours of leave.`,
            "/flex-time"
          );

          results.deducted++;
        } else {
          // No remaining deficit, just mark as settled
          await prisma.flexTimeMonthlySummary.update({
            where: { id: summary.id },
            data: {
              status: "SETTLED",
              settledAt: new Date(),
            },
          });
        }

        results.settled++;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown error";
        results.errors.push(
          `Failed to settle ${summary.employeeId}: ${msg}`
        );
      }
    }

    return Response.json({
      yearMonth,
      totalProcessed: openSummaries.length,
      ...results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
