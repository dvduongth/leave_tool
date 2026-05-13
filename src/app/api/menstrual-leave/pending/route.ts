import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { MenstrualStatus } from "@/generated/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = request.nextUrl;
    const statusParam = searchParams.get("status");

    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { role: true, departmentId: true },
    });

    if (!employee || (employee.role !== "MANAGER" && employee.role !== "HEAD" && employee.role !== "ADMIN")) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const status = statusParam === "PENDING_HEAD"
      ? MenstrualStatus.PENDING_HEAD
      : MenstrualStatus.PENDING_MANAGER;

    // Build where clause based on role
    const baseWhere = { status };
    const managerWhere = { status, employee: { managerId: user.id } };
    const headWhere = { status, employee: { departmentId: employee.departmentId } };

    const whereClause = employee.role === "MANAGER"
      ? managerWhere
      : employee.role === "HEAD"
        ? headWhere
        : baseWhere; // ADMIN sees all

    const records = await prisma.menstrualLeave.findMany({
      where: whereClause,
      include: {
        employee: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return Response.json(records);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
