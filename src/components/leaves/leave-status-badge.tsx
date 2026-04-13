"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LeaveStatus } from "@/generated/prisma";

const statusConfig: Record<
  LeaveStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Draft",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  PENDING_MANAGER: {
    label: "Pending Manager",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  PENDING_HEAD: {
    label: "Pending Head",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  },
  APPROVED: {
    label: "Approved",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  CANCELLED: {
    label: "Cancelled",
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  CANCEL_PENDING: {
    label: "Cancel Pending",
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const config = statusConfig[status];
  return (
    <Badge
      variant="outline"
      className={cn("border-0 font-medium", config.className)}
    >
      {config.label}
    </Badge>
  );
}
