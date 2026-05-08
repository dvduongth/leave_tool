import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as {
    id: string;
    name: string;
    role: "ADMIN" | "HEAD" | "MANAGER" | "EMPLOYEE";
    departmentId: string;
    gender?: "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";
  };

  // Force first-login password change: anyone with mustChangePassword=true is
  // redirected to /settings until they update their password. The settings page
  // itself is allowed so the user can perform the change.
  const flags = await prisma.employee.findUnique({
    where: { id: user.id },
    select: { mustChangePassword: true },
  });
  if (flags?.mustChangePassword) {
    const h = await headers();
    const path = h.get("x-pathname") || h.get("next-url") || "";
    if (!path.startsWith("/settings")) {
      redirect("/settings");
    }
  }

  return (
    <DashboardShell
      userName={user.name ?? "User"}
      role={user.role}
      gender={user.gender ?? "UNSPECIFIED"}
    >
      {children}
    </DashboardShell>
  );
}
