import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { createNotification, clearNotificationsForEntity } from "@/lib/notifications";
import { logAudit, getRequestIp } from "@/lib/audit";
import { Role, ShiftType } from "@/generated/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (user.role !== Role.MANAGER && user.role !== Role.HEAD && user.role !== Role.ADMIN) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const req = await prisma.shiftChangeRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, name: true, managerId: true, departmentId: true },
        },
      },
    });
    if (!req) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }
    if (req.status !== "PENDING") {
      return Response.json(
        { error: `Cannot approve in ${req.status} status` },
        { status: 400 }
      );
    }

    const isManager = req.employee.managerId === user.id;
    const isAdmin = user.role === Role.ADMIN;
    if (!isManager && !isAdmin) {
      return Response.json(
        { error: "You cannot approve this request" },
        { status: 403 }
      );
    }

    const weeklyShifts = req.weeklyShifts as Record<string, ShiftType>;
    const effectiveDate = req.effectiveDate;

    // Bug 4 fix: atomic status guard
    const guard = await prisma.shiftChangeRequest.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "APPROVED", approvedBy: user.id, approvedAt: new Date() },
    });
    if (guard.count === 0) {
      return Response.json(
        { error: "Request was already processed" },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Close existing active rows for each dayOfWeek (set endDate = effectiveDate - 1 day)
      const closeDate = new Date(effectiveDate);
      closeDate.setUTCDate(closeDate.getUTCDate() - 1);

      await tx.employeeWeekShift.updateMany({
        where: {
          employeeId: req.employeeId,
          endDate: null,
          effectiveDate: { lt: effectiveDate },
        },
        data: { endDate: closeDate },
      });

      // Insert new rows for each dayOfWeek
      for (let dow = 1; dow <= 5; dow++) {
        const shiftType = weeklyShifts[String(dow)];
        if (!shiftType) continue;
        await tx.employeeWeekShift.upsert({
          where: {
            employeeId_dayOfWeek_effectiveDate: {
              employeeId: req.employeeId,
              dayOfWeek: dow,
              effectiveDate,
            },
          },
          update: { shiftType, endDate: null },
          create: {
            employeeId: req.employeeId,
            dayOfWeek: dow,
            shiftType,
            effectiveDate,
          },
        });
      }

      // Status already updated atomically above via the guard.
    });

    // Bug 7 fix: clear approver-side pending notifications
    await clearNotificationsForEntity("shift", id);

    await createNotification(
      req.employeeId,
      "Yêu cầu đổi ca đã được duyệt",
      `Yêu cầu đổi ca làm hiệu lực từ ${effectiveDate.toISOString().slice(0, 10)} đã được duyệt`,
      `/shift`
    );

    await logAudit({
      userId: user.id,
      action: "SHIFT_CHANGE_APPROVE",
      entity: "shift_change_request",
      entityId: id,
      metadata: {
        targetEmployee: req.employee.name,
        effectiveDate: effectiveDate.toISOString().slice(0, 10),
        weeklyShifts,
      },
      ipAddress: getRequestIp(request),
    });

    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "Unauthorized") {
      return Response.json({ error: message }, { status: 401 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
