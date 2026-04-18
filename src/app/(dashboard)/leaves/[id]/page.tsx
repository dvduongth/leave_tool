"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarIcon,
  Clock,
  FileText,
  Send,
  Trash2,
  Edit2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { LeaveStatusBadge } from "@/components/leaves/leave-status-badge";
import { TranslateText } from "@/components/translate-text";
import { useT } from "@/lib/i18n/provider";
import type { LeaveStatus } from "@/generated/prisma";

// Time slots for edit mode
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 7; h <= 19; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 19 && m > 0) break;
      slots.push(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
      );
    }
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

interface HistoryEntry {
  id: string;
  action: string;
  comment: string | null;
  createdAt: string;
  actor: { name: string } | null;
}

interface LeaveDetail {
  id: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  totalHours: number;
  reason: string | null;
  status: LeaveStatus;
  createdAt: string;
  updatedAt: string;
  employee: { name: string; email: string };
  history: HistoryEntry[];
}

export default function LeaveDetailPage() {
  const router = useRouter();
  const params = useParams();
  const t = useT();
  const id = params.id as string;

  const [leave, setLeave] = useState<LeaveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Edit form state
  const [editStartDate, setEditStartDate] = useState<Date | undefined>();
  const [editStartTime, setEditStartTime] = useState("");
  const [editTotalHours, setEditTotalHours] = useState("");
  const [editReason, setEditReason] = useState("");

  async function fetchLeave() {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaves/${id}`);
      if (res.ok) {
        const data = await res.json();
        setLeave(data);
      } else {
        toast.error(t("leaveDetail.notFound"));
        router.push("/leaves");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeave();
  }, [id]);

  function enterEditMode() {
    if (!leave) return;
    setEditStartDate(new Date(leave.startDate));
    setEditStartTime(leave.startTime);
    setEditTotalHours(String(leave.totalHours));
    setEditReason(leave.reason || "");
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!editStartDate || parseFloat(editTotalHours) <= 0) {
      toast.error(t("leaveDetail.errValidDateHours"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leaves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: editStartDate.toISOString(),
          startTime: editStartTime,
          totalHours: parseFloat(editTotalHours),
          reason: editReason || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("leaveDetail.errUpdate"));
        return;
      }
      toast.success(t("leaveDetail.toastUpdated"));
      setEditing(false);
      fetchLeave();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leaves/${id}/submit`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("leaveDetail.errSubmit"));
        return;
      }
      toast.success(t("leaveDetail.toastSubmitted"));
      fetchLeave();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leaves/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("leaveDetail.errDelete"));
        return;
      }
      toast.success(t("leaveDetail.toastDeleted"));
      router.push("/leaves");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leaves/${id}/cancel`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("leaveDetail.errCancel"));
        return;
      }
      toast.success(t("leaveDetail.toastCancelSubmitted"));
      setCancelDialogOpen(false);
      fetchLeave();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditAndResubmit() {
    if (!editStartDate || parseFloat(editTotalHours) <= 0) {
      toast.error(t("leaveDetail.errValidDateHours"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leaves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: editStartDate.toISOString(),
          startTime: editStartTime,
          totalHours: parseFloat(editTotalHours),
          reason: editReason || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("leaveDetail.errUpdate"));
        return;
      }

      const submitRes = await fetch(`/api/leaves/${id}/submit`, {
        method: "POST",
      });
      if (!submitRes.ok) {
        const err = await submitRes.json().catch(() => ({}));
        toast.error(err.error || t("leaveDetail.errUpdatedNotSubmitted"));
        fetchLeave();
        return;
      }

      toast.success(t("leaveDetail.toastUpdatedResubmitted"));
      setEditing(false);
      fetchLeave();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!leave) return null;

  const canEdit =
    leave.status === "DRAFT" ||
    leave.status === "PENDING_MANAGER" ||
    leave.status === "REJECTED";
  const canSubmit = leave.status === "DRAFT";
  const canDelete = leave.status === "DRAFT";
  const canCancel =
    leave.status === "PENDING_MANAGER" || leave.status === "PENDING_HEAD";
  const canRequestCancel = leave.status === "APPROVED";
  const isRejected = leave.status === "REJECTED";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/leaves")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t("leaveDetail.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("leaveDetail.createdAt").replace(
              "{date}",
              format(new Date(leave.createdAt), "MMM d, yyyy 'at' HH:mm")
            )}
          </p>
        </div>
        <LeaveStatusBadge status={leave.status} />
      </div>

      {/* Detail Card / Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            {editing ? t("leaveDetail.editLeave") : t("leaveDetail.leaveDetails")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("newLeave.startDate")}</Label>
                <Popover>
                  <PopoverTrigger
                    className="flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm hover:bg-muted"
                  >
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    {editStartDate ? (
                      format(editStartDate, "EEEE, MMMM d, yyyy")
                    ) : (
                      <span className="text-muted-foreground">{t("common.pickDate")}</span>
                    )}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editStartDate}
                      onSelect={(date) => setEditStartDate(date ?? undefined)}
                      disabled={(date) => {
                        const day = date.getDay();
                        return day === 0 || day === 6;
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>{t("newLeave.startTime")}</Label>
                <Select
                  value={editStartTime}
                  onValueChange={(val) => setEditStartTime(val as string)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("newLeave.selectTime")} />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("leaveDetail.totalHours")}</Label>
                <Input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={editTotalHours}
                  onChange={(e) => setEditTotalHours(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("leaveDetail.reason")}</Label>
                <Textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => setEditing(false)}
                  disabled={submitting}
                >
                  {t("common.cancel")}
                </Button>
                {isRejected ? (
                  <Button
                    disabled={submitting}
                    onClick={handleEditAndResubmit}
                  >
                    <Send className="size-4" data-icon="inline-start" />
                    {t("leaveDetail.saveResubmit")}
                  </Button>
                ) : (
                  <Button disabled={submitting} onClick={handleSaveEdit}>
                    {t("leaveDetail.saveChanges")}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t("leaveDetail.start")}</p>
                  <p className="font-medium">
                    {format(new Date(leave.startDate), "MMM d, yyyy")}{" "}
                    {leave.startTime}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("leaveDetail.end")}</p>
                  <p className="font-medium">
                    {format(new Date(leave.endDate), "MMM d, yyyy")}{" "}
                    {leave.endTime}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("leaveDetail.totalHours")}</p>
                  <p className="font-medium">{leave.totalHours}h</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("leaveDetail.status")}</p>
                  <LeaveStatusBadge status={leave.status} />
                </div>
              </div>
              {leave.reason && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("leaveDetail.reason")}</p>
                  <TranslateText text={leave.reason} className="text-sm" />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {!editing && (
        <div className="flex flex-wrap gap-2 justify-end">
          {canEdit && (
            <Button variant="outline" onClick={enterEditMode}>
              <Edit2 className="size-4" data-icon="inline-start" />
              {isRejected ? t("leaveDetail.editResubmit") : t("common.edit")}
            </Button>
          )}
          {canSubmit && (
            <Button disabled={submitting} onClick={handleSubmit}>
              <Send className="size-4" data-icon="inline-start" />
              {t("leaveDetail.submitApproval")}
            </Button>
          )}
          {canDelete && (
            <Dialog>
              <DialogTrigger
                render={
                  <Button variant="destructive" disabled={submitting} />
                }
              >
                <Trash2 className="size-4" data-icon="inline-start" />
                {t("common.delete")}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("leaveDetail.deleteDialogTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("leaveDetail.deleteDialogDesc")}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    {t("common.cancel")}
                  </DialogClose>
                  <Button
                    variant="destructive"
                    disabled={submitting}
                    onClick={handleDelete}
                  >
                    {t("common.delete")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {(canCancel || canRequestCancel) && (
            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
              <DialogTrigger
                render={
                  <Button variant="outline" disabled={submitting} />
                }
              >
                <X className="size-4" data-icon="inline-start" />
                {canRequestCancel ? t("leaveDetail.requestCancel") : t("leaveDetail.cancelRequest")}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {canRequestCancel
                      ? t("leaveDetail.cancelDialogTitleRequest")
                      : t("leaveDetail.cancelDialogTitleCancel")}
                  </DialogTitle>
                  <DialogDescription>
                    {canRequestCancel
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
                    onClick={handleCancel}
                  >
                    {t("common.confirm")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}

      {/* Approval Timeline */}
      {leave.history && leave.history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4" />
              {t("leaveDetail.approvalTimeline")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leave.history.map((entry, index) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {index + 1}
                    </div>
                    {index < leave.history.length - 1 && (
                      <div className="flex-1 w-px bg-border mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-medium">
                        {entry.actor?.name || t("leaveDetail.system")}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {format(
                          new Date(entry.createdAt),
                          "MMM d, yyyy 'at' HH:mm"
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {entry.action.replace(/_/g, " ")}
                    </p>
                    {entry.comment && (
                      <div className="mt-1 rounded bg-muted/50 p-2">
                        <TranslateText
                          text={entry.comment}
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
