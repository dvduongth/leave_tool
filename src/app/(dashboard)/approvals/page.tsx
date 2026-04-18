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
import type { LeaveStatus } from "@/generated/prisma";

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

type RejectMode = "leave" | "cancel";

export default function ApprovalsPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [leaves, setLeaves] = useState<PendingLeave[]>([]);
  const [cancelRequests, setCancelRequests] = useState<PendingLeave[]>([]);
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

      const [leavesRes, cancelsRes] = await Promise.all([
        fetch(`/api/leaves?status=${status}&pending=true`),
        fetch(`/api/leaves?status=CANCEL_PENDING&pending=true`),
      ]);

      if (leavesRes.ok) setLeaves(await leavesRes.json());
      if (cancelsRes.ok) setCancelRequests(await cancelsRes.json());
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
      const endpoint =
        rejectMode === "cancel"
          ? `/api/leaves/${rejectTargetId}/reject-cancel`
          : `/api/leaves/${rejectTargetId}/reject`;
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
      toast.success(
        rejectMode === "cancel"
          ? t("approvals.toastCancelRejected")
          : t("approvals.toastRejected")
      );
      if (rejectMode === "cancel") {
        setCancelRequests((prev) => prev.filter((l) => l.id !== rejectTargetId));
      } else {
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

  const nothingPending = leaves.length === 0 && cancelRequests.length === 0;

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
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rejectMode === "cancel"
                ? t("approvals.rejectCancelTitle")
                : t("approvals.rejectTitle")}
            </DialogTitle>
            <DialogDescription>
              {rejectMode === "cancel"
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
