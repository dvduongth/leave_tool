"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Users, User, MoreHorizontal, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { useLeaves, useTeamMembers } from "@/lib/swr";
import { fetchWithRetry } from "@/lib/fetch-retry";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
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
  employee?: { id: string; name: string };
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
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
  const { data: session } = useSession();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [scope, setScope] = useState<"own" | "team">("own");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("ALL");
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<LeaveRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const canViewTeam = userRole === "MANAGER" || userRole === "HEAD" || userRole === "ADMIN";

  // SWR hooks for data fetching with caching
  const { data: teamData } = useTeamMembers();
  const teamMembers: TeamMember[] = (scope === "team" && canViewTeam && teamData?.members) || [];

  const { data: leavesData, isLoading: loading } = useLeaves({
    status: statusFilter !== "ALL" ? statusFilter : undefined,
    from: dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined,
    to: dateTo ? format(dateTo, "yyyy-MM-dd") : undefined,
    scope,
    employeeId: scope === "team" && selectedEmployeeId !== "ALL" ? selectedEmployeeId : undefined,
  });
  const leaves: LeaveRow[] = leavesData ?? [];

  // Reset employee filter when switching scope
  useEffect(() => {
    setSelectedEmployeeId("ALL");
  }, [scope]);

  const { mutate } = useLeaves({
    status: statusFilter !== "ALL" ? statusFilter : undefined,
    from: dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined,
    to: dateTo ? format(dateTo, "yyyy-MM-dd") : undefined,
    scope,
    employeeId: scope === "team" && selectedEmployeeId !== "ALL" ? selectedEmployeeId : undefined,
  });

  async function handleRequestCancel() {
    if (!cancelTarget) return;
    setSubmitting(true);
    try {
      const res = await fetchWithRetry(`/api/leaves/${cancelTarget.id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("leaveDetail.errCancel"));
        return;
      }
      toast.success(t("leaveDetail.toastCancelSubmitted"));
      setCancelDialogOpen(false);
      setCancelTarget(null);
      mutate();
    } catch {
      toast.error("Kết nối thất bại, vui lòng thử lại");
    } finally {
      setSubmitting(false);
    }
  }

  function openCancelDialog(leave: LeaveRow, e: React.MouseEvent) {
    e.stopPropagation();
    setCancelTarget(leave);
    setCancelDialogOpen(true);
  }

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
        {/* Scope toggle for Manager/Head/Admin */}
        {canViewTeam && (
          <div className="inline-flex rounded-lg border p-1">
            <Button
              variant={scope === "own" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5"
              onClick={() => setScope("own")}
            >
              <User className="size-3.5" />
              {t("leaves.scopeOwn")}
            </Button>
            <Button
              variant={scope === "team" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5"
              onClick={() => setScope("team")}
            >
              <Users className="size-3.5" />
              {t("leaves.scopeTeam")}
            </Button>
          </div>
        )}

        {/* Employee filter (only in team mode) */}
        {scope === "team" && teamMembers.length > 0 && (
          <Select
            value={selectedEmployeeId}
            onValueChange={(val) => val && setSelectedEmployeeId(val)}
          >
            <SelectTrigger className="w-48">
              <span className="truncate">
                {selectedEmployeeId === "ALL"
                  ? t("common.allMembers")
                  : teamMembers.find((m) => m.id === selectedEmployeeId)?.name ??
                    t("common.selectMember")}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("common.allMembers")}</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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

        <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
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
              onSelect={(date) => { setDateFrom(date ?? undefined); setDateFromOpen(false); }}
            />
          </PopoverContent>
        </Popover>

        <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
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
              onSelect={(date) => { setDateTo(date ?? undefined); setDateToOpen(false); }}
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
              {scope === "team" && <TableHead>{t("leaves.colEmployee")}</TableHead>}
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
                <TableCell colSpan={scope === "team" ? 7 : 6} className="h-24 text-center text-muted-foreground">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : leaves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={scope === "team" ? 7 : 6} className="h-24 text-center text-muted-foreground">
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
                  {scope === "team" && (
                    <TableCell className="font-medium">
                      {leave.employee?.name || "-"}
                    </TableCell>
                  )}
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
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => router.push(`/leaves/${leave.id}`)}
                        >
                          <Eye className="size-4" />
                          {t("common.viewDetails")}
                        </DropdownMenuItem>
                        {leave.status === "APPROVED" && (scope === "own" || leave.employee?.id === userId) && (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={(e) => openCancelDialog(leave, e as unknown as React.MouseEvent)}
                          >
                            <X className="size-4" />
                            {t("leaveDetail.requestCancel")}
                          </DropdownMenuItem>
                        )}
                        {(leave.status === "PENDING_MANAGER" || leave.status === "PENDING_HEAD") &&
                         (scope === "own" || leave.employee?.id === userId) && (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={(e) => openCancelDialog(leave, e as unknown as React.MouseEvent)}
                          >
                            <X className="size-4" />
                            {t("leaveDetail.cancelRequest")}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cancelTarget?.status === "APPROVED"
                ? t("leaveDetail.cancelDialogTitleRequest")
                : t("leaveDetail.cancelDialogTitleCancel")}
            </DialogTitle>
            <DialogDescription>
              {cancelTarget?.status === "APPROVED"
                ? t("leaveDetail.cancelDialogDescRequest")
                : t("leaveDetail.cancelDialogDescCancel")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.goBack")}
            </DialogClose>
            <Button
              variant="destructive"
              disabled={submitting}
              onClick={handleRequestCancel}
            >
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
