import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";

export async function GET(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const { searchParams } = request.nextUrl;
    const departmentId = searchParams.get("departmentId");
    const role = searchParams.get("role");

    const where: Record<string, unknown> = {};
    if (departmentId) where.departmentId = departmentId;
    if (role) where.role = role;

    const employees = await prisma.employee.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    return Response.json(employees);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    if (message === "Forbidden")
      return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await request.json();
    const { name, email, password, role, workShift, departmentId, managerId } =
      body;

    if (!name || !email || !password || !role || !workShift || !departmentId) {
      return Response.json(
        { error: "Missing required fields: name, email, password, role, workShift, departmentId" },
        { status: 400 }
      );
    }

    // Check for duplicate email
    const existing = await prisma.employee.findUnique({ where: { email } });
    if (existing) {
      return Response.json(
        { error: "An employee with this email already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine current leave cycle (June reset: cycle runs June 1 - May 31)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const cycleYear = currentMonth >= 5 ? currentYear : currentYear - 1; // June=5
    const cycleStart = new Date(cycleYear, 5, 1); // June 1
    const cycleEnd = new Date(cycleYear + 1, 4, 31); // May 31
    const graceDeadline = new Date(cycleYear + 1, 6, 31); // July 31

    const employee = await prisma.employee.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        workShift,
        departmentId,
        managerId: managerId || null,
        leaveBalances: {
          create: {
            cycleYear,
            cycleStart,
            cycleEnd,
            totalHours: 96,
            usedHours: 0,
            pendingHours: 0,
            graceDeadline,
          },
        },
      },
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        leaveBalances: true,
      },
    });

    return Response.json(employee, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    if (message === "Forbidden")
      return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: message }, { status: 500 });
  }
}
