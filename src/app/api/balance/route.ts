import { getCurrentUser } from "@/lib/auth-utils";
import { getActiveBalance } from "@/lib/leave-calculator";
import prisma from "@/lib/prisma";
import { Role } from "@/generated/prisma";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId") || user.id;

    // RBAC: check if user can view this employee's balance
    if (employeeId !== user.id) {
      const canView = await canViewEmployee(user, employeeId);
      if (!canView) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const balance = await getActiveBalance(employeeId, new Date());

    return Response.json(balance);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("No active leave balance")) {
      return Response.json({ error: message }, { status: 404 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}

async function canViewEmployee(
  user: { id: string; role: Role; departmentId: string },
  employeeId: string
): Promise<boolean> {
  if (user.role === Role.ADMIN) return true;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { departmentId: true, managerId: true },
  });
  if (!employee) return false;

  if (user.role === Role.HEAD && employee.departmentId === user.departmentId) {
    return true;
  }

  if (user.role === Role.MANAGER && employee.managerId === user.id) {
    return true;
  }

  return false;
}
