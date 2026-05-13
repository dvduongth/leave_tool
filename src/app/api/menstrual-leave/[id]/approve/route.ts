import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { createNotification } from "@/lib/notifications";
import { MenstrualStatus } from "@/generated/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body as { action: "approve" | "reject"; reason?: string };

    if (!action || !["approve", "reject"].includes(action)) {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    const record = await prisma.menstrualLeave.findUnique({
      where: { id },
      include: {
        employee: {
          select: { name: true, managerId: true, departmentId: true },
        },
      },
    });

    if (!record) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { role: true, departmentId: true },
    });

    if (!employee) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    const isManager = record.employee.managerId === user.id;
    const isHead =
      employee.role === "HEAD" &&
      employee.departmentId === record.employee.departmentId;
    const isAdmin = employee.role === "ADMIN";

    // Check authorization based on current status
    if (record.status === MenstrualStatus.PENDING_MANAGER) {
      if (!isManager && !isHead && !isAdmin) {
        return Response.json({ error: "Not authorized" }, { status: 403 });
      }
    } else if (record.status === MenstrualStatus.PENDING_HEAD) {
      if (!isHead && !isAdmin) {
        return Response.json({ error: "Not authorized" }, { status: 403 });
      }
    } else {
      return Response.json(
        { error: "Record is not pending approval" },
        { status: 400 }
      );
    }

    if (action === "reject") {
      if (!reason?.trim()) {
        return Response.json(
          { error: "Reason required for rejection" },
          { status: 400 }
        );
      }
      const updated = await prisma.menstrualLeave.update({
        where: { id },
        data: { status: MenstrualStatus.REJECTED },
      });

      await createNotification(
        record.employeeId,
        "Wellness leave rejected",
        `Your wellness leave on ${record.date.toISOString().split("T")[0]} was rejected: ${reason}`,
        `/wellness`
      );

      return Response.json(updated);
    }

    // Approve flow
    if (record.status === MenstrualStatus.PENDING_MANAGER) {
      // Manager approves → forward to Head
      const updated = await prisma.menstrualLeave.update({
        where: { id },
        data: { status: MenstrualStatus.PENDING_HEAD },
      });

      // Find Head to notify
      const dept = await prisma.department.findUnique({
        where: { id: record.employee.departmentId! },
        select: { headId: true },
      });

      if (dept?.headId) {
        await createNotification(
          dept.headId,
          "Wellness leave pending approval",
          `${record.employee.name}'s wellness leave needs your approval`,
          `/approvals`
        );
      }

      return Response.json(updated);
    }

    // Head/Admin final approval
    const updated = await prisma.menstrualLeave.update({
      where: { id },
      data: { status: MenstrualStatus.APPROVED },
    });

    await createNotification(
      record.employeeId,
      "Wellness leave approved",
      `Your wellness leave on ${record.date.toISOString().split("T")[0]} was approved`,
      `/wellness`
    );

    return Response.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
