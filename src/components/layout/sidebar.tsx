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
  BookOpen,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import type { Role } from "@/generated/prisma";

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
}

const navItems: NavItem[] = [
  { labelKey: "nav.dashboard", href: "/", icon: LayoutDashboard },
  { labelKey: "nav.myLeaves", href: "/leaves", icon: CalendarDays },
  {
    labelKey: "nav.approvals",
    href: "/approvals",
    icon: CheckSquare,
    roles: ["MANAGER", "HEAD", "ADMIN"],
  },
  { labelKey: "nav.ot", href: "/ot", icon: Clock },
  { labelKey: "nav.flexTime", href: "/flex-time", icon: Timer },
  {
    labelKey: "nav.reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["MANAGER", "HEAD", "ADMIN"],
  },
  { labelKey: "nav.help", href: "/help", icon: BookOpen },
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
];

const adminItems: NavItem[] = [
  { labelKey: "nav.employees", href: "/admin/employees", icon: Users },
  { labelKey: "nav.holidays", href: "/admin/holidays", icon: CalendarOff },
];

interface SidebarProps {
  role: Role;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const t = useT();

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
        <h1 className="text-lg font-semibold">{t("app.name")}</h1>
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
              {t(item.labelKey)}
            </Link>
          );
        })}

        {role === "ADMIN" && (
          <>
            <div className="my-3 border-t pt-3">
              <span className="px-3 text-xs font-semibold uppercase text-muted-foreground">
                {t("nav.admin")}
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
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </aside>
  );
}
