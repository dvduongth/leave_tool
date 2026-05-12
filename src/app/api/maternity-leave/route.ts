import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { getConfigNumber } from "@/lib/config";
import { findEligibleChild } from "@/lib/maternity";
import { createNotification } from "@/lib/notifications";
import { Role } from "@/generated/prisma";

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = request.nextUrl;
    const month = searchParams.get("month");
    const status = searchParams.get("status");

    const where: {
      employeeId?: string | { in: string[] };
      date?: { gte: Date; lt: Date };
      status?: "PENDING" | "APPROVED" | "REJECTED";
    } = {};

    if (user.role === Role.EMPLOYEE) {
      where.employeeId = user.id;
    } else if (user.role === Role.MANAGER) {
      const subs = await prisma.employee.findMany({
        where: { managerId: user.id },
        select: { id: true },
      });
      where.employeeId = { in: [user.id, ...subs.map((s) => s.id)] };
    } else if (user.role === Role.HEAD) {
      const dept = await prisma.employee.findMany({
        where: { departmentId: user.departmentId },
        select: { id: true },
      });
      where.employeeId = { in: dept.map((e) => e.id) };
    }

    if (month) {
      const [y, m] = month.split("-").map(Number);
      where.date = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
    }
    if (status === "PENDING" || status === "APPROVED" || status === "REJECTED") {
      where.status = status;
    }

    const records = await prisma.maternityLeave.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true } },
        child: { select: { id: true, birthDate: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    return Response.json(records);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "Unauthorized") return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { date, mode, startTime, endTime, note } = body ?? {};

    if (!date || !mode || !startTime || !endTime) {
      return Response.json(
        { error: "date, mode, startTime, endTime are required" },
        { status: 400 }
      );
    }
    const noteTrimmed = typeof note === "string" ? note.trim() : "";
    if (!noteTrimmed) {
      return Response.json({ error: "Vui lòng nhập lý do" }, { status: 400 });
    }
    if (mode !== "EARLY_LEAVE" && mode !== "LATE_ARRIVAL") {
      return Response.json({ error: "mode must be EARLY_LEAVE or LATE_ARRIVAL" }, { status: 400 });
    }
    const tre = /^\d{2}:\d{2}$/;
    if (!tre.test(startTime) || !tre.test(endTime)) {
      return Response.json({ error: "time must be HH:MM" }, { status: 400 });
    }

    const dayDate = new Date(date);
    if (isNaN(dayDate.getTime())) {
      return Response.json({ error: "Invalid date" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { gender: true, name: true, managerId: true },
    });
    if (!employee || employee.gender !== "FEMALE") {
      return Response.json(
        { error: "Chỉ nhân viên nữ được hưởng chế độ thai sản" },
        { status: 403 }
      );
    }

    const child = await findEligibleChild(user.id, dayDate);
    if (!child) {
      return Response.json(
        { error: "Bạn không có con dưới 1 tuổi đã được duyệt — không đủ điều kiện" },
        { status: 403 }
      );
    }

    const expectedMinutes = await getConfigNumber("MATERNITY_LEAVE_DURATION_MINUTES");
    const actualMinutes = durationMinutes(startTime, endTime);
    if (actualMinutes !== expectedMinutes) {
      return Response.json(
        { error: `Khoảng thời gian phải đúng ${expectedMinutes} phút (đang là ${actualMinutes})` },
        { status: 400 }
      );
    }

    const created = await prisma.maternityLeave.create({
      data: {
        employeeId: user.id,
        childId: child.id,
        date: dayDate,
        mode,
        startTime,
        endTime,
        note: noteTrimmed,
        status: "PENDING",
      },
    });

    if (employee.managerId) {
      await createNotification(
        employee.managerId,
        "Đăng ký nghỉ thai sản",
        `${employee.name} đã đăng ký nghỉ thai sản (${mode === "EARLY_LEAVE" ? "về sớm" : "đi muộn"} 1 tiếng) ngày ${dayDate.toISOString().slice(0, 10)}`,
        `/maternity`,
        "maternity",
        created.id
      );
    }

    return Response.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "Unauthorized") return Response.json({ error: message }, { status: 401 });
    if (message.includes("Unique constraint")) {
      return Response.json({ error: "Đã có đăng ký cho ngày này" }, { status: 409 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
