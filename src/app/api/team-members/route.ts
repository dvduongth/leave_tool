import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { Role } from "@/generated/prisma";

export async function GET() {
  try {
    const user = await requireAuth();

    let members: { id: string; name: string; email: string; joinDate: Date | null }[] = [];

    if (user.role === Role.EMPLOYEE) {
      // Employee can only see themselves
      const self = await prisma.employee.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, email: true, joinDate: true },
      });
      members = self ? [self] : [];
    } else if (user.role === Role.MANAGER) {
      // Manager sees their direct reports (sorted by seniority)
      const subordinates = await prisma.employee.findMany({
        where: { managerId: user.id },
        select: { id: true, name: true, email: true, joinDate: true },
        orderBy: { joinDate: { sort: "asc", nulls: "last" } },
      });
      members = subordinates;
    } else if (user.role === Role.HEAD) {
      // Head sees all department members (excluding self, sorted by seniority)
      const deptMembers = await prisma.employee.findMany({
        where: { departmentId: user.departmentId, id: { not: user.id } },
        select: { id: true, name: true, email: true, joinDate: true },
        orderBy: { joinDate: { sort: "asc", nulls: "last" } },
      });
      members = deptMembers;
    } else if (user.role === Role.ADMIN) {
      // Admin sees all employees (excluding self, sorted by seniority)
      const allEmployees = await prisma.employee.findMany({
        where: { id: { not: user.id } },
        select: { id: true, name: true, email: true, joinDate: true },
        orderBy: { joinDate: { sort: "asc", nulls: "last" } },
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
