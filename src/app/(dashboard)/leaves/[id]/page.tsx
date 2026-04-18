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
        toast.error("Leave request not found.");
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
      toast.error("Please fill in valid date and hours.");
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
        toast.error(err.error || "Failed to update leave.");
        return;
      }
      toast.success("Leave updated.");
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
        toast.error(err.error || "Failed to submit.");
        return;
      }
      toast.success("Leave submitted for approval.");
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
        toast.error(err.error || "Failed to delete.");
        return;
      }
      toast.success("Leave deleted.");
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
        toast.error(err.error || "Failed to cancel.");
        return;
      }
      toast.success("Cancel request submitted.");
      setCancelDialogOpen(false);
      fetchLeave();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditAndResubmit() {
    if (!editStartDate || parseFloat(editTotalHours) <= 0) {
      toast.error("Please fill in valid date and hours.");
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
        toast.error(err.error || "Failed to update.");
        return;
      }

      const submitRes = await fetch(`/api/leaves/${id}/submit`, {
        method: "POST",
      });
      if (!submitRes.ok) {
        const err = await submitRes.json().catch(() => ({}));
        toast.error(err.error || "Updated but failed to submit.");
        fetchLeave();
        return;
      }

      toast.success("Leave updated and resubmitted.");
      setEditing(false);
      fetchLeave();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading...
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
          <h1 className="text-2xl font-bold">Leave Request</h1>
          <p className="text-sm text-muted-foreground">
            Created {format(new Date(leave.createdAt), "MMM d, yyyy 'at' HH:mm")}
          </p>
        </div>
        <LeaveStatusBadge status={leave.status} />
      </div>

      {/* Detail Card / Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            {editing ? "Edit Leave" : "Leave Details"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger
                    className="flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm hover:bg-muted"
                  >
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    {editStartDate ? (
                      format(editStartDate, "EEEE, MMMM d, yyyy")
                    ) : (
                      <span className="text-muted-foreground">Pick a date</span>
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
                <Label>Start Time</Label>
                <Select
                  value={editStartTime}
                  onValueChange={(val) => setEditStartTime(val as string)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select time" />
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
                <Label>Total Hours</Label>
                <Input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={editTotalHours}
                  onChange={(e) => setEditTotalHours(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Reason</Label>
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
                  Cancel
                </Button>
                {isRejected ? (
                  <Button
                    disabled={submitting}
                    onClick={handleEditAndResubmit}
                  >
                    <Send className="size-4" data-icon="inline-start" />
                    Save & Resubmit
                  </Button>
                ) : (
                  <Button disabled={submitting} onClick={handleSaveEdit}>
                    Save Changes
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Start</p>
                  <p className="font-medium">
                    {format(new Date(leave.startDate), "MMM d, yyyy")}{" "}
                    {leave.startTime}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">End</p>
                  <p className="font-medium">
                    {format(new Date(leave.endDate), "MMM d, yyyy")}{" "}
                    {leave.endTime}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Hours</p>
                  <p className="font-medium">{leave.totalHours}h</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <LeaveStatusBadge status={leave.status} />
                </div>
              </div>
              {leave.reason && (
                <div>
                  <p className="text-xs text-muted-foreground">Reason</p>
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
              {isRejected ? "Edit & Resubmit" : "Edit"}
            </Button>
          )}
          {canSubmit && (
            <Button disabled={submitting} onClick={handleSubmit}>
              <Send className="size-4" data-icon="inline-start" />
              Submit for Approval
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
                Delete
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Leave Request</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. The leave request will be
                    permanently deleted.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <Button
                    variant="destructive"
                    disabled={submitting}
                    onClick={handleDelete}
                  >
                    Delete
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
                {canRequestCancel ? "Request Cancel" : "Cancel Request"}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {canRequestCancel
                      ? "Request Cancellation"
                      : "Cancel Leave Request"}
                  </DialogTitle>
                  <DialogDescription>
                    {canRequestCancel
                      ? "This will submit a cancellation request for this approved leave."
                      : "This will cancel your pending leave request."}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Go Back
                  </DialogClose>
                  <Button
                    variant="destructive"
                    disabled={submitting}
                    onClick={handleCancel}
                  >
                    Confirm
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
              Approval Timeline
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
                        {entry.actor?.name || "System"}
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
