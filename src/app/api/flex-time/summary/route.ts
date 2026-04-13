import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = request.nextUrl;
    const month = searchParams.get("month"); // YYYY-MM
    const employeeId = searchParams.get("employeeId") || user.id;

    if (!month) {
      return Response.json(
        { error: "month query parameter is required (YYYY-MM)" },
        { status: 400 }
      );
    }

    const summary = await prisma.flexTimeMonthlySummary.findUnique({
      where: {
        employeeId_yearMonth: {
          employeeId,
          yearMonth: month,
        },
      },
      include: {
        employee: { select: { id: true, name: true } },
      },
    });

    if (!summary) {
      return Response.json({
        employeeId,
        yearMonth: month,
        totalDeficit: 0,
        totalMakeup: 0,
        remaining: 0,
        autoDeductHours: null,
        status: "OPEN",
        settledAt: null,
      });
    }

    return Response.json(summary);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
