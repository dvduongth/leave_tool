import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        leaveBalances: { orderBy: { cycleYear: "desc" } },
      },
    });

    if (!employee) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    return Response.json(employee);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    if (message === "Forbidden")
      return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const body = await request.json();
    const { name, email, password, role, workShift, departmentId, managerId } =
      body;

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    // Check email uniqueness if changed
    if (email && email !== existing.email) {
      const emailTaken = await prisma.employee.findUnique({ where: { email } });
      if (emailTaken) {
        return Response.json(
          { error: "An employee with this email already exists" },
          { status: 409 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (workShift !== undefined) data.workShift = workShift;
    if (departmentId !== undefined) data.departmentId = departmentId;
    if (managerId !== undefined) data.managerId = managerId || null;
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.employee.update({
      where: { id },
      data,
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        leaveBalances: { orderBy: { cycleYear: "desc" } },
      },
    });

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
