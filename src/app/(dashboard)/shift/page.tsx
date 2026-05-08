"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon, CheckCircle, XCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const DAY_LABELS_VI = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
const SHIFT_OPTIONS: { value: "A" | "B" | "C"; label: string }[] = [
  { value: "A", label: "Ca A (07:00–17:00, T6: 16:00)" },
  { value: "B", label: "Ca B (07:30–17:30, T6: 16:30)" },
  { value: "C", label: "Ca C (09:00–19:00, T6: 10:00–19:00)" },
];

interface MyShift {
  weeklyShifts: Record<string, "A" | "B" | "C">;
  asOf: string;
  fallback: "A" | "B" | "C";
}

interface ShiftChangeRequest {
  id: string;
  employeeId: string;
  effectiveDate: string;
  weeklyShifts: Record<string, "A" | "B" | "C">;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  managerComment: string | null;
  approvedAt: string | null;
  createdAt: string;
  employee?: { id: string; name: string; email: string };
  approver?: { id: string; name: string } | null;
}

function statusVariant(s: string): "default" | "secondary" | "destructive" {
  if (s === "APPROVED") return "default";
  if (s === "REJECTED") return "destructive";
  return "secondary";
}

export default function ShiftPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const isApprover = role === "MANAGER" || role === "HEAD" || role === "ADMIN";

  const [mySchedule, setMySchedule] = useState<MyShift | null>(null);
  const [requests, setRequests] = useState<ShiftChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formEffective, setFormEffective] = useState<Date | undefined>(undefined);
  const [formShifts, setFormShifts] = useState<Record<number, "A" | "B" | "C">>({
    1: "A",
    2: "A",
    3: "A",
    4: "A",
    5: "A",
  });
  const [formReason, setFormReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, listRes] = await Promise.all([
        fetch("/api/shift/me"),
        fetch("/api/shift/change-request"),
      ]);
      if (meRes.ok) {
        const d = await meRes.json();
        setMySchedule(d);
        // Pre-fill form with current schedule
        setFormShifts((prev) => ({ ...prev, ...d.weeklyShifts }));
      }
      if (listRes.ok) setRequests(await listRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleSubmit() {
    if (!formEffective) {
      toast.error("Cần chọn ngày hiệu lực");
      return;
    }
    setSubmitting(true);
    try {
      const dateStr = `${formEffective.getFullYear()}-${String(formEffective.getMonth() + 1).padStart(2, "0")}-${String(formEffective.getDate()).padStart(2, "0")}`;
      const res = await fetch("/api/shift/change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effectiveDate: dateStr,
          weeklyShifts: formShifts,
          reason: formReason || null,
        }),
      });
      if (res.ok) {
        toast.success("Yêu cầu đổi ca đã được gửi đi");
        setDialogOpen(false);
        setFormReason("");
        setFormEffective(undefined);
        fetchAll();
      } else {
        const data = await res.json();
        toast.error(data.error || "Gửi yêu cầu thất bại");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(reqId: string, action: "approve" | "reject") {
    try {
      const res = await fetch(`/api/shift/change-request/${reqId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ comment: "" }) : undefined,
      });
      if (res.ok) {
        toast.success(action === "approve" ? "Đã duyệt" : "Đã từ chối");
        fetchAll();
      } else {
        const data = await res.json();
        toast.error(data.error || "Thao tác thất bại");
      }
    } catch {
      toast.error("Lỗi không mong muốn");
    }
  }

  const myRequests = requests.filter((r) => r.employeeId === userId);
  const pendingTeam = requests.filter(
    (r) => r.status === "PENDING" && r.employeeId !== userId
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ca làm việc</h1>
          <p className="text-sm text-muted-foreground">
            Lịch ca làm trong tuần và đăng ký đổi ca
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Đăng ký đổi ca
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lịch ca hiện tại của tôi</CardTitle>
        </CardHeader>
        <CardContent>
          {!mySchedule ? (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((dow) => (
                <div
                  key={dow}
                  className="rounded-md border p-3 text-center"
                >
                  <div className="text-xs text-muted-foreground">
                    {DAY_LABELS_VI[dow]}
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    Ca {mySchedule.weeklyShifts[String(dow)] ?? mySchedule.fallback}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">Yêu cầu của tôi</TabsTrigger>
          {isApprover && (
            <TabsTrigger value="pending">
              Chờ duyệt ({pendingTeam.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="mine">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hiệu lực từ</TableHead>
                  <TableHead>Lịch mới</TableHead>
                  <TableHead>Lý do</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : myRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Chưa có yêu cầu nào
                    </TableCell>
                  </TableRow>
                ) : (
                  myRequests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.effectiveDate.slice(0, 10)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {[1, 2, 3, 4, 5]
                          .map((dow) => `T${dow + 1}:${r.weeklyShifts[String(dow)] ?? "-"}`)
                          .join(" ")}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {r.reason || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {format(new Date(r.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {isApprover && (
          <TabsContent value="pending">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nhân viên</TableHead>
                    <TableHead>Hiệu lực từ</TableHead>
                    <TableHead>Lịch mới</TableHead>
                    <TableHead>Lý do</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTeam.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Không có yêu cầu chờ duyệt
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingTeam.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.employee?.name}</TableCell>
                        <TableCell>{r.effectiveDate.slice(0, 10)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {[1, 2, 3, 4, 5]
                            .map((dow) => `T${dow + 1}:${r.weeklyShifts[String(dow)] ?? "-"}`)
                            .join(" ")}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {r.reason || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAction(r.id, "approve")}
                          >
                            <CheckCircle className="size-4" />
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAction(r.id, "reject")}
                          >
                            <XCircle className="size-4" />
                            Từ chối
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Đăng ký đổi ca</DialogTitle>
            <DialogDescription>
              Chọn lịch ca mới cho từng ngày trong tuần. Yêu cầu sẽ được Manager duyệt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Hiệu lực từ ngày</Label>
              <Popover>
                <PopoverTrigger className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm hover:bg-muted">
                  <CalendarIcon className="size-4 text-muted-foreground" />
                  {formEffective
                    ? format(formEffective, "MMM d, yyyy")
                    : "Chọn ngày"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formEffective}
                    onSelect={setFormEffective}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Lịch ca</Label>
              <div className="grid grid-cols-1 gap-2">
                {[1, 2, 3, 4, 5].map((dow) => (
                  <div key={dow} className="flex items-center gap-3">
                    <span className="w-16 text-sm">{DAY_LABELS_VI[dow]}</span>
                    <Select
                      value={formShifts[dow]}
                      onValueChange={(v) =>
                        setFormShifts({ ...formShifts, [dow]: v as "A" | "B" | "C" })
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHIFT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Lý do (tuỳ chọn)</Label>
              <Textarea
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="Lý do đổi ca..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
