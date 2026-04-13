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

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_MANAGER", label: "Pending Manager" },
  { value: "PENDING_HEAD", label: "Pending Head" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "CANCEL_PENDING", label: "Cancel Pending" },
];

export default function LeavesPage() {
  const router = useRouter();
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
          <h1 className="text-2xl font-bold">My Leaves</h1>
          <p className="text-sm text-muted-foreground">
            View and manage your leave requests
          </p>
        </div>
        <Button onClick={() => router.push("/leaves/new")}>
          <Plus className="size-4" data-icon="inline-start" />
          New Leave
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val as string)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm text-muted-foreground hover:bg-muted"
          >
            <CalendarIcon className="size-4" />
            {dateFrom ? format(dateFrom, "MMM d, yyyy") : "From date"}
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
            {dateTo ? format(dateTo, "MMM d, yyyy") : "To date"}
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
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : leaves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No leave requests found.
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
