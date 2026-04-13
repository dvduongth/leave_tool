import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
  };

  return (
    <DashboardShell userName={user.name ?? "User"} role={user.role}>
      {children}
    </DashboardShell>
  );
}
