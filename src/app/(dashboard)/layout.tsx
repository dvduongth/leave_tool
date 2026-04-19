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
    gender?: "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";
  };

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
