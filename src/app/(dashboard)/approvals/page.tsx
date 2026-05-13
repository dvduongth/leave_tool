"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CheckCircle, XCircle, User, Ban } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Separator } from "@/components/ui/separator";
import { useT } from "@/lib/i18n/provider";
import type { LeaveStatus, RecordStatus } from "@/generated/prisma";

interface PendingLeave {
  id: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  reason: string | null;
  status: LeaveStatus;
  createdAt: string;
  employee: {
    name: string;
    email: string;
    remainingBalance?: number;
  };
}

interface PendingOT {
  id: string;
  date: string;
  otStart: string;
  otEnd: string;
  otMinutes: number;
  note: string | null;
  status: RecordStatus;
  employee: {
    name: string;
    email: string;
  };
}

type RejectMode = "leave" | "cancel" | "ot-cancel";

export default function ApprovalsPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [leaves, setLeaves] = useState<PendingLeave[]>([]);
  const [cancelRequests, setCancelRequests] = useState<PendingLeave[]>([]);
  const [otCancelRequests, setOtCancelRequests] = useState<PendingOT[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectMode, setRejectMode] = useState<RejectMode>("leave");
  const [rejectComment, setRejectComment] = useState("");

  async function fetchPending() {
    setLoading(true);
    try {
      const status =
        role === "HEAD" || role === "ADMIN" ? "PENDING_HEAD" : "PENDING_MANAGER";

      const [leavesRes, cancelsRes, otCancelsRes] = await Promise.all([
        fetch(`/api/leaves?status=${status}`),
        fetch(`/api/leaves?status=CANCEL_PENDING`),
        fetch(`/api/ot?status=CANCEL_PENDING`),
      ]);

      if (leavesRes.ok) setLeaves(await leavesRes.json());
      if (cancelsRes.ok) setCancelRequests(await cancelsRes.json());
      if (otCancelsRes.ok) setOtCancelRequests(await otCancelsRes.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (role) fetchPending();
  }, [role]);

  async function handleApprove(leaveId: string) {
    setProcessingId(leaveId);
    try {
      const res = await fetch(`/api/leaves/${leaveId}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("approvals.errApprove"));
        return;
      }
      toast.success(t("approvals.toastApproved"));
      setLeaves((prev) => prev.filter((l) => l.id !== leaveId));
    } finally {
      setProcessingId(null);
    }
  }

  async function handleApproveCancel(leaveId: string) {
    setProcessingId(leaveId);
    try {
      const res = await fetch(`/api/leaves/${leaveId}/approve-cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("approvals.errApproveCancel"));
        return;
      }
      toast.success(t("approvals.toastCancelApproved"));
      setCancelRequests((prev) => prev.filter((l) => l.id !== leaveId));
    } finally {
      setProcessingId(null);
    }
  }

  async function handleApproveOtCancel(otId: string) {
    setProcessingId(otId);
    try {
      const res = await fetch(`/api/ot/${otId}/approve-cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("approvals.errApproveCancel"));
        return;
      }
      toast.success(t("approvals.toastOtCancelApproved"));
      setOtCancelRequests((prev) => prev.filter((o) => o.id !== otId));
    } finally {
      setProcessingId(null);
    }
  }

  function openRejectDialog(leaveId: string, mode: RejectMode) {
    setRejectTargetId(leaveId);
    setRejectMode(mode);
    setRejectComment("");
    setRejectDialogOpen(true);
  }

  async function handleReject() {
    if (!rejectTargetId) return;
    if (!rejectComment.trim()) {
      toast.error(t("approvals.errRejectReason"));
      return;
    }

    setProcessingId(rejectTargetId);
    try {
      let endpoint: string;
      if (rejectMode === "ot-cancel") {
        endpoint = `/api/ot/${rejectTargetId}/reject-cancel`;
      } else if (rejectMode === "cancel") {
        endpoint = `/api/leaves/${rejectTargetId}/reject-cancel`;
      } else {
        endpoint = `/api/leaves/${rejectTargetId}/reject`;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: rejectComment }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("approvals.errReject"));
        return;
      }

      if (rejectMode === "ot-cancel") {
        toast.success(t("approvals.toastOtCancelRejected"));
        setOtCancelRequests((prev) => prev.filter((o) => o.id !== rejectTargetId));
      } else if (rejectMode === "cancel") {
        toast.success(t("approvals.toastCancelRejected"));
        setCancelRequests((prev) => prev.filter((l) => l.id !== rejectTargetId));
      } else {
        toast.success(t("approvals.toastRejected"));
        setLeaves((prev) => prev.filter((l) => l.id !== rejectTargetId));
      }
      setRejectDialogOpen(false);
      setRejectTargetId(null);
    } finally {
      setProcessingId(null);
    }
  }

  // Guard: only accessible to managers/heads/admins
  if (role && !["MANAGER", "HEAD", "ADMIN"].includes(role)) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("approvals.noPermission")}
      </div>
    );
  }

  const renderLeaveCard = (
    leave: PendingLeave,
    mode: "leave" | "cancel"
  ) => (
    <Card key={leave.id}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {mode === "cancel" ? (
                <Ban className="size-4 text-amber-600" />
              ) : (
                <User className="size-4" />
              )}
              {leave.employee.name}
            </CardTitle>
            <CardDescription>{leave.employee.email}</CardDescription>
          </div>
          <LeaveStatusBadge status={leave.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === "cancel" && (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {t("approvals.cancelRequestNote")}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">
              {t("approvals.start")}
            </p>
            <p className="text-sm font-medium">
              {format(new Date(leave.startDate), "MMM d, yyyy")} {leave.startTime}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("approvals.end")}
            </p>
            <p className="text-sm font-medium">
              {format(new Date(leave.endDate), "MMM d, yyyy")} {leave.endTime}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("approvals.hours")}
            </p>
            <p className="text-sm font-medium">{leave.totalHours}h</p>
          </div>
          {leave.employee.remainingBalance !== undefined && (
            <div>
              <p className="text-xs text-muted-foreground">
                {t("approvals.remainingBalance")}
              </p>
              <p className="text-sm font-medium">
                {leave.employee.remainingBalance}h
              </p>
            </div>
          )}
        </div>

        {leave.reason && (
          <div>
            <p className="text-xs text-muted-foreground">
              {t("approvals.reason")}
            </p>
            <p className="mt-1 rounded bg-muted/50 p-2 text-sm">
              {leave.reason}
            </p>
          </div>
        )}

        <Separator />

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            disabled={processingId === leave.id}
            onClick={() => openRejectDialog(leave.id, mode)}
          >
            <XCircle className="size-4" data-icon="inline-start" />
            {mode === "cancel"
              ? t("approvals.rejectCancel")
              : t("common.reject")}
          </Button>
          <Button
            disabled={processingId === leave.id}
            onClick={() =>
              mode === "cancel"
                ? handleApproveCancel(leave.id)
                : handleApprove(leave.id)
            }
          >
            <CheckCircle className="size-4" data-icon="inline-start" />
            {mode === "cancel"
              ? t("approvals.approveCancel")
              : t("common.approve")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderOtCancelCard = (ot: PendingOT) => (
    <Card key={ot.id}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Ban className="size-4 text-amber-600" />
              {ot.employee.name}
            </CardTitle>
            <CardDescription>{ot.employee.email}</CardDescription>
          </div>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            {t("common.status.CANCEL_PENDING")}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {t("approvals.otCancelRequestNote")}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">{t("approvals.date")}</p>
            <p className="text-sm font-medium">
              {format(new Date(ot.date), "MMM d, yyyy")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("approvals.time")}</p>
            <p className="text-sm font-medium">
              {ot.otStart} - {ot.otEnd}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("approvals.minutes")}</p>
            <p className="text-sm font-medium">{ot.otMinutes} min</p>
          </div>
        </div>

        {ot.note && (
          <div>
            <p className="text-xs text-muted-foreground">{t("approvals.note")}</p>
            <p className="mt-1 rounded bg-muted/50 p-2 text-sm">{ot.note}</p>
          </div>
        )}

        <Separator />

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            disabled={processingId === ot.id}
            onClick={() => openRejectDialog(ot.id, "ot-cancel")}
          >
            <XCircle className="size-4" data-icon="inline-start" />
            {t("approvals.rejectCancel")}
          </Button>
          <Button
            disabled={processingId === ot.id}
            onClick={() => handleApproveOtCancel(ot.id)}
          >
            <CheckCircle className="size-4" data-icon="inline-start" />
            {t("approvals.approveCancel")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const nothingPending = leaves.length === 0 && cancelRequests.length === 0 && otCancelRequests.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("approvals.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("approvals.subtitle")}
        </p>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : nothingPending ? (
        <Card>
          <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
            {t("approvals.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {leaves.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {t("approvals.sectionNew")} ({leaves.length})
              </h2>
              <div className="grid gap-4">
                {leaves.map((l) => renderLeaveCard(l, "leave"))}
              </div>
            </div>
          )}
          {cancelRequests.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {t("approvals.sectionCancel")} ({cancelRequests.length})
              </h2>
              <div className="grid gap-4">
                {cancelRequests.map((l) => renderLeaveCard(l, "cancel"))}
              </div>
            </div>
          )}
          {otCancelRequests.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {t("approvals.sectionOtCancel")} ({otCancelRequests.length})
              </h2>
              <div className="grid gap-4">
                {otCancelRequests.map((ot) => renderOtCancelCard(ot))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rejectMode === "ot-cancel"
                ? t("approvals.rejectOtCancelTitle")
                : rejectMode === "cancel"
                  ? t("approvals.rejectCancelTitle")
                  : t("approvals.rejectTitle")}
            </DialogTitle>
            <DialogDescription>
              {rejectMode === "ot-cancel"
                ? t("approvals.rejectOtCancelDesc")
                : rejectMode === "cancel"
                  ? t("approvals.rejectCancelDesc")
                  : t("approvals.rejectDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("approvals.rejectReasonLabel")}</Label>
            <Textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder={t("approvals.rejectReasonPlaceholder")}
              rows={3}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              disabled={processingId !== null}
              onClick={handleReject}
            >
              {t("common.reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
