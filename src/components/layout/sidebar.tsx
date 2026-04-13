"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  Clock,
  Timer,
  BarChart3,
  Users,
  CalendarOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/generated/prisma";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "My Leaves", href: "/leaves", icon: CalendarDays },
  {
    label: "Approvals",
    href: "/approvals",
    icon: CheckSquare,
    roles: ["MANAGER", "HEAD", "ADMIN"],
  },
  { label: "OT Records", href: "/ot", icon: Clock },
  { label: "Flex Time", href: "/flex-time", icon: Timer },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["MANAGER", "HEAD", "ADMIN"],
  },
];

const adminItems: NavItem[] = [
  { label: "Employees", href: "/admin/employees", icon: Users },
  { label: "Holidays", href: "/admin/holidays", icon: CalendarOff },
];

interface SidebarProps {
  role: Role;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-background">
      <div className="flex h-14 items-center border-b px-4">
        <h1 className="text-lg font-semibold">Leave Manager</h1>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}

        {role === "ADMIN" && (
          <>
            <div className="my-3 border-t pt-3">
              <span className="px-3 text-xs font-semibold uppercase text-muted-foreground">
                Admin
              </span>
            </div>
            {adminItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </aside>
  );
}
