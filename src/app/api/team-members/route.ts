import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { Role } from "@/generated/prisma";

export async function GET() {
  try {
    const user = await requireAuth();

    let members: { id: string; name: string; email: string }[] = [];

    if (user.role === Role.EMPLOYEE) {
      // Employee can only see themselves
      members = [{ id: user.id, name: user.name, email: user.email }];
    } else if (user.role === Role.MANAGER) {
      // Manager sees their direct reports
      const subordinates = await prisma.employee.findMany({
        where: { managerId: user.id },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      });
      members = subordinates;
    } else if (user.role === Role.HEAD) {
      // Head sees all department members (excluding self)
      const deptMembers = await prisma.employee.findMany({
        where: { departmentId: user.departmentId, id: { not: user.id } },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      });
      members = deptMembers;
    } else if (user.role === Role.ADMIN) {
      // Admin sees all employees (excluding self)
      const allEmployees = await prisma.employee.findMany({
        where: { id: { not: user.id } },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      });
      members = allEmployees;
    }

    return Response.json({ members });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
