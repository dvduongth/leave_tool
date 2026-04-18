"use client";

import { signOut } from "next-auth/react";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "./notifications-bell";
import type { Role } from "@/generated/prisma";

interface HeaderProps {
  userName: string;
  role: Role;
  onMenuToggle?: () => void;
}

const roleBadgeColors: Record<Role, string> = {
  ADMIN: "bg-red-100 text-red-800",
  HEAD: "bg-purple-100 text-purple-800",
  MANAGER: "bg-blue-100 text-blue-800",
  EMPLOYEE: "bg-green-100 text-green-800",
};

export function Header({ userName, role, onMenuToggle }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuToggle}
        >
          <Menu className="size-5" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{userName}</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeColors[role]}`}
          >
            {role}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NotificationsBell />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
