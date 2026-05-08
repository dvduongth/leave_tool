import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { Role } from "@/generated/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");

    const where: { employeeId?: string | { in: string[] }; status?: "PENDING" | "APPROVED" | "REJECTED" } = {};

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

    if (status === "PENDING" || status === "APPROVED" || status === "REJECTED") {
      where.status = status;
    }

    const children = await prisma.employeeChild.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, email: true, gender: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(children);
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
    const { birthDate, name, note } = body ?? {};

    if (!birthDate) {
      return Response.json({ error: "birthDate is required" }, { status: 400 });
    }
    const bd = new Date(birthDate);
    if (isNaN(bd.getTime())) {
      return Response.json({ error: "Invalid birthDate" }, { status: 400 });
    }
    if (bd > new Date()) {
      return Response.json({ error: "birthDate must be in the past" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { gender: true },
    });
    if (!employee || employee.gender !== "FEMALE") {
      return Response.json(
        { error: "Chỉ nhân viên nữ được phép đăng ký chế độ thai sản" },
        { status: 403 }
      );
    }

    const created = await prisma.employeeChild.create({
      data: {
        employeeId: user.id,
        birthDate: bd,
        name: name || null,
        note: note || null,
        status: "PENDING",
      },
    });
    return Response.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "Unauthorized") return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
