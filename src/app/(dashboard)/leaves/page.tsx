"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { LeaveStatusBadge } from "@/components/leaves/leave-status-badge";
import { useT } from "@/lib/i18n/provider";
import type { LeaveStatus } from "@/generated/prisma";

interface LeaveRow {
  id: string;
  startDate: string;
  endDate: string;
  totalHours: number;
  status: LeaveStatus;
  createdAt: string;
  reason: string | null;
}

const STATUS_VALUES = [
  "ALL",
  "DRAFT",
  "PENDING_MANAGER",
  "PENDING_HEAD",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "CANCEL_PENDING",
];

export default function LeavesPage() {
  const router = useRouter();
  const t = useT();
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (dateFrom) params.set("from", dateFrom.toISOString());
      if (dateTo) params.set("to", dateTo.toISOString());

      const res = await fetch(`/api/leaves?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeaves(data);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("leaves.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("leaves.subtitle")}
          </p>
        </div>
        <Button onClick={() => router.push("/leaves/new")}>
          <Plus className="size-4" data-icon="inline-start" />
          {t("leaves.newLeave")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val as string)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("leaves.filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_VALUES.map((v) => (
              <SelectItem key={v} value={v}>
                {t(`common.status.${v}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm text-muted-foreground hover:bg-muted"
          >
            <CalendarIcon className="size-4" />
            {dateFrom ? format(dateFrom, "MMM d, yyyy") : t("common.fromDate")}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={(date) => setDateFrom(date ?? undefined)}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm text-muted-foreground hover:bg-muted"
          >
            <CalendarIcon className="size-4" />
            {dateTo ? format(dateTo, "MMM d, yyyy") : t("common.toDate")}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={(date) => setDateTo(date ?? undefined)}
            />
          </PopoverContent>
        </Popover>

        {(statusFilter !== "ALL" || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("ALL");
              setDateFrom(undefined);
              setDateTo(undefined);
            }}
          >
            {t("common.clearFilters")}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("leaves.colStartDate")}</TableHead>
              <TableHead>{t("leaves.colEndDate")}</TableHead>
              <TableHead className="text-right">{t("leaves.colHours")}</TableHead>
              <TableHead>{t("leaves.colStatus")}</TableHead>
              <TableHead>{t("leaves.colCreated")}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : leaves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {t("leaves.empty")}
                </TableCell>
              </TableRow>
            ) : (
              leaves.map((leave) => (
                <TableRow
                  key={leave.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/leaves/${leave.id}`)}
                >
                  <TableCell>
                    {format(new Date(leave.startDate), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {format(new Date(leave.endDate), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">{leave.totalHours}</TableCell>
                  <TableCell>
                    <LeaveStatusBadge status={leave.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(leave.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">&rarr;</span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
