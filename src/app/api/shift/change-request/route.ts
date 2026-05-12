import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { createNotification } from "@/lib/notifications";
import { Role, ShiftType } from "@/generated/prisma";

const VALID_SHIFTS: ShiftType[] = ["A", "B", "C"];

function validateWeeklyShifts(input: unknown): Record<number, ShiftType> | null {
  if (!input || typeof input !== "object") return null;
  const result: Record<number, ShiftType> = {};
  for (let dow = 1; dow <= 5; dow++) {
    const v = (input as Record<string, unknown>)[String(dow)];
    if (!v || typeof v !== "string" || !VALID_SHIFTS.includes(v as ShiftType)) {
      return null;
    }
    result[dow] = v as ShiftType;
  }
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");

    const where: { employeeId?: string | { in: string[] }; status?: "PENDING" | "APPROVED" | "REJECTED" } = {};

    if (user.role === Role.EMPLOYEE) {
      where.employeeId = user.id;
    } else if (user.role === Role.MANAGER) {
      const subordinates = await prisma.employee.findMany({
        where: { managerId: user.id },
        select: { id: true },
      });
      where.employeeId = { in: [user.id, ...subordinates.map((s) => s.id)] };
    } else if (user.role === Role.HEAD) {
      const dept = await prisma.employee.findMany({
        where: { departmentId: user.departmentId },
        select: { id: true },
      });
      where.employeeId = { in: dept.map((e) => e.id) };
    }
    // ADMIN: no filter

    if (status === "PENDING" || status === "APPROVED" || status === "REJECTED") {
      where.status = status;
    }

    const requests = await prisma.shiftChangeRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(requests);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "Unauthorized") {
      return Response.json({ error: message }, { status: 401 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { effectiveDate, weeklyShifts, reason } = body ?? {};

    if (!effectiveDate) {
      return Response.json({ error: "effectiveDate is required" }, { status: 400 });
    }
    const eff = new Date(effectiveDate);
    if (isNaN(eff.getTime())) {
      return Response.json({ error: "Invalid effectiveDate" }, { status: 400 });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eff < today) {
      return Response.json(
        { error: "effectiveDate must be today or later" },
        { status: 400 }
      );
    }

    const valid = validateWeeklyShifts(weeklyShifts);
    if (!valid) {
      return Response.json(
        { error: "weeklyShifts must be {1..5: 'A'|'B'|'C'}" },
        { status: 400 }
      );
    }

    const reasonTrimmed = typeof reason === "string" ? reason.trim() : "";
    if (!reasonTrimmed) {
      return Response.json({ error: "Vui lòng nhập lý do" }, { status: 400 });
    }

    // No overlap pending: reject if employee already has PENDING
    const existingPending = await prisma.shiftChangeRequest.findFirst({
      where: { employeeId: user.id, status: "PENDING" },
    });
    if (existingPending) {
      return Response.json(
        { error: "Bạn đã có 1 yêu cầu đổi ca đang chờ duyệt", existingId: existingPending.id },
        { status: 409 }
      );
    }

    const created = await prisma.shiftChangeRequest.create({
      data: {
        employeeId: user.id,
        effectiveDate: eff,
        weeklyShifts: valid as never,
        reason: reasonTrimmed,
        status: "PENDING",
      },
    });

    // Notify the approving manager
    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { name: true, managerId: true },
    });
    if (employee?.managerId) {
      await createNotification(
        employee.managerId,
        "Yêu cầu đổi ca mới",
        `${employee.name} đăng ký đổi ca làm hiệu lực từ ${eff.toISOString().slice(0, 10)}`,
        `/shift`,
        "shift",
        created.id
      );
    }

    return Response.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "Unauthorized") {
      return Response.json({ error: message }, { status: 401 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
