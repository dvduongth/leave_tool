import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import prisma from "@/lib/prisma";
import { Role } from "@/generated/prisma";

export const EMPLOYEE_REMOVED = "EmployeeRemoved";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user) return null;
  return session.user as { id: string; email: string; name: string; role: Role; departmentId: string };
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireValidEmployee() {
  const user = await requireAuth();
  const exists = await prisma.employee.findUnique({
    where: { id: user.id },
    select: { id: true },
  });
  if (!exists) throw new Error(EMPLOYEE_REMOVED);
  return user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) throw new Error("Forbidden");
  return user;
}
