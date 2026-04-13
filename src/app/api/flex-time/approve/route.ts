import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("MANAGER", "HEAD");
    const body = await request.json();
    const { recordId, action } = body;

    if (action !== "APPROVED" && action !== "REJECTED") {
      return Response.json(
        { error: "Action must be APPROVED or REJECTED" },
        { status: 400 }
      );
    }

    // Fetch the record with employee info
    const record = await prisma.flexTimeRecord.findUnique({
      where: { id: recordId },
      include: {
        employee: { select: { id: true, managerId: true, departmentId: true } },
      },
    });

    if (!record) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }

    if (record.status !== "PENDING") {
      return Response.json(
        { error: "Record is not in PENDING status" },
        { status: 400 }
      );
    }

    // Verify the record belongs to their team
    const isManager = record.employee.managerId === user.id;
    const isDeptHead =
      user.role === "HEAD" &&
      record.employee.departmentId === user.departmentId;

    if (!isManager && !isDeptHead) {
      return Response.json(
        { error: "You can only approve records for your team members" },
        { status: 403 }
      );
    }

    // Update the record status
    const updated = await prisma.flexTimeRecord.update({
      where: { id: recordId },
      data: {
        status: action,
        approvedBy: user.id,
      },
    });

    // If APPROVED: update FlexTimeMonthlySummary
    if (action === "APPROVED") {
      const recordDate = new Date(record.date);
      const yearMonth = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, "0")}`;

      const summary = await prisma.flexTimeMonthlySummary.upsert({
        where: {
          employeeId_yearMonth: {
            employeeId: record.employeeId,
            yearMonth,
          },
        },
        create: {
          employeeId: record.employeeId,
          yearMonth,
          totalDeficit: record.type === "DEFICIT" ? record.minutes : 0,
          totalMakeup: record.type === "MAKEUP" ? record.minutes : 0,
          remaining:
            record.type === "DEFICIT" ? record.minutes : -record.minutes,
          status: "OPEN",
        },
        update: {
          totalDeficit:
            record.type === "DEFICIT"
              ? { increment: record.minutes }
              : undefined,
          totalMakeup:
            record.type === "MAKEUP"
              ? { increment: record.minutes }
              : undefined,
          remaining:
            record.type === "DEFICIT"
              ? { increment: record.minutes }
              : { decrement: record.minutes },
        },
      });
    }

    return Response.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    if (message === "Forbidden")
      return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: message }, { status: 500 });
  }
}
