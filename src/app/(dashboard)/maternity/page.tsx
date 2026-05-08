"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, CalendarIcon, CheckCircle, XCircle, Baby } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface Child {
  id: string;
  birthDate: string;
  name: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note: string | null;
  approvedAt: string | null;
  employeeId: string;
  employee?: { id: string; name: string; gender: string };
}

interface MaternityLeave {
  id: string;
  employeeId: string;
  childId: string;
  date: string;
  mode: "EARLY_LEAVE" | "LATE_ARRIVAL";
  startTime: string;
  endTime: string;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  employee?: { id: string; name: string };
  child?: { id: string; birthDate: string; name: string | null };
}

function statusVariant(s: string): "default" | "secondary" | "destructive" {
  if (s === "APPROVED") return "default";
  if (s === "REJECTED") return "destructive";
  return "secondary";
}

export default function MaternityPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const gender = (session?.user as { gender?: string } | undefined)?.gender;
  const isApprover = role === "MANAGER" || role === "HEAD" || role === "ADMIN";
  const isFemale = gender === "FEMALE";

  const [children, setChildren] = useState<Child[]>([]);
  const [leaves, setLeaves] = useState<MaternityLeave[]>([]);
  const [loading, setLoading] = useState(true);

  // Child declare dialog
  const [childDialog, setChildDialog] = useState(false);
  const [childBirth, setChildBirth] = useState<Date | undefined>(undefined);
  const [childName, setChildName] = useState("");
  const [childNote, setChildNote] = useState("");

  // Maternity leave log dialog
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [leaveDate, setLeaveDate] = useState<Date | undefined>(undefined);
  const [leaveMode, setLeaveMode] = useState<"EARLY_LEAVE" | "LATE_ARRIVAL">("EARLY_LEAVE");
  const [leaveStart, setLeaveStart] = useState("16:00");
  const [leaveEnd, setLeaveEnd] = useState("17:00");
  const [leaveNote, setLeaveNote] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, l] = await Promise.all([
        fetch("/api/maternity/child"),
        fetch("/api/maternity-leave"),
      ]);
      if (c.ok) setChildren(await c.json());
      if (l.ok) setLeaves(await l.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function declareChild() {
    if (!childBirth) {
      toast.error("Cần chọn ngày sinh con");
      return;
    }
    setSubmitting(true);
    try {
      const dateStr = `${childBirth.getFullYear()}-${String(childBirth.getMonth() + 1).padStart(2, "0")}-${String(childBirth.getDate()).padStart(2, "0")}`;
      const res = await fetch("/api/maternity/child", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate: dateStr, name: childName || null, note: childNote || null }),
      });
      if (res.ok) {
        toast.success("Đã gửi khai báo con");
        setChildDialog(false);
        setChildBirth(undefined);
        setChildName("");
        setChildNote("");
        fetchAll();
      } else {
        const d = await res.json();
        toast.error(d.error || "Khai báo thất bại");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function logLeave() {
    if (!leaveDate) {
      toast.error("Cần chọn ngày");
      return;
    }
    setSubmitting(true);
    try {
      const dateStr = `${leaveDate.getFullYear()}-${String(leaveDate.getMonth() + 1).padStart(2, "0")}-${String(leaveDate.getDate()).padStart(2, "0")}`;
      const res = await fetch("/api/maternity-leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          mode: leaveMode,
          startTime: leaveStart,
          endTime: leaveEnd,
          note: leaveNote || null,
        }),
      });
      if (res.ok) {
        toast.success("Đã gửi đăng ký");
        setLeaveDialog(false);
        setLeaveDate(undefined);
        setLeaveNote("");
        fetchAll();
      } else {
        const d = await res.json();
        toast.error(d.error || "Đăng ký thất bại");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function approveChild(id: string, action: "approve" | "reject") {
    const res = await fetch(`/api/maternity/child/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "reject" ? JSON.stringify({ comment: "" }) : undefined,
    });
    if (res.ok) {
      toast.success(action === "approve" ? "Đã duyệt khai báo" : "Đã từ chối");
      fetchAll();
    } else {
      const d = await res.json();
      toast.error(d.error || "Thất bại");
    }
  }

  async function approveLeave(id: string, action: "approve" | "reject") {
    const res = await fetch(`/api/maternity-leave/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "reject" ? JSON.stringify({ comment: "" }) : undefined,
    });
    if (res.ok) {
      toast.success(action === "approve" ? "Đã duyệt" : "Đã từ chối");
      fetchAll();
    } else {
      const d = await res.json();
      toast.error(d.error || "Thất bại");
    }
  }

  if (!isFemale && role !== "ADMIN" && !isApprover) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Chế độ thai sản chỉ áp dụng cho nhân viên nữ.</p>
      </div>
    );
  }

  const myChildren = children.filter((c) => c.employeeId === userId);
  const pendingChildren = children.filter((c) => c.status === "PENDING" && c.employeeId !== userId);
  const myLeaves = leaves.filter((l) => l.employeeId === userId);
  const pendingLeaves = leaves.filter((l) => l.status === "PENDING" && l.employeeId !== userId);
  const hasApprovedChild = myChildren.some((c) => c.status === "APPROVED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chế độ thai sản</h1>
          <p className="text-sm text-muted-foreground">
            Khai báo con dưới 1 tuổi và đăng ký nghỉ sớm/đi muộn 1 tiếng/ngày
          </p>
        </div>
        <div className="flex gap-2">
          {isFemale && (
            <Button variant="outline" onClick={() => setChildDialog(true)}>
              <Baby className="size-4" />
              Khai báo con
            </Button>
          )}
          {isFemale && hasApprovedChild && (
            <Button onClick={() => setLeaveDialog(true)}>
              <Plus className="size-4" />
              Đăng ký nghỉ
            </Button>
          )}
        </div>
      </div>

      {isFemale && (
        <Card>
          <CardHeader>
            <CardTitle>Con của tôi</CardTitle>
          </CardHeader>
          <CardContent>
            {myChildren.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa khai báo con nào</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày sinh</TableHead>
                    <TableHead>Tên con</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myChildren.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.birthDate.slice(0, 10)}</TableCell>
                      <TableCell>{c.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-[300px] truncate">
                        {c.note || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">Lịch sử của tôi</TabsTrigger>
          {isApprover && (
            <TabsTrigger value="pending">
              Chờ duyệt ({pendingChildren.length + pendingLeaves.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="mine">
          <Card>
            <CardHeader>
              <CardTitle>Đăng ký nghỉ thai sản</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Đang tải...</p>
              ) : myLeaves.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có đăng ký</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Ghi chú</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myLeaves.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.date.slice(0, 10)}</TableCell>
                        <TableCell>{l.mode === "EARLY_LEAVE" ? "Về sớm" : "Đi muộn"}</TableCell>
                        <TableCell>{l.startTime}–{l.endTime}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(l.status)}>{l.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                          {l.note || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isApprover && (
          <TabsContent value="pending" className="space-y-4">
            {pendingChildren.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Khai báo con chờ duyệt ({pendingChildren.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nhân viên</TableHead>
                        <TableHead>Ngày sinh</TableHead>
                        <TableHead>Tên con</TableHead>
                        <TableHead>Ghi chú</TableHead>
                        <TableHead className="text-right">Hành động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingChildren.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.employee?.name}</TableCell>
                          <TableCell>{c.birthDate.slice(0, 10)}</TableCell>
                          <TableCell>{c.name || "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                            {c.note || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => approveChild(c.id, "approve")}>
                              <CheckCircle className="size-4" />
                              Duyệt
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => approveChild(c.id, "reject")}>
                              <XCircle className="size-4" />
                              Từ chối
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {pendingLeaves.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Đăng ký nghỉ chờ duyệt ({pendingLeaves.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nhân viên</TableHead>
                        <TableHead>Ngày</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Thời gian</TableHead>
                        <TableHead className="text-right">Hành động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingLeaves.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>{l.employee?.name}</TableCell>
                          <TableCell>{l.date.slice(0, 10)}</TableCell>
                          <TableCell>{l.mode === "EARLY_LEAVE" ? "Về sớm" : "Đi muộn"}</TableCell>
                          <TableCell>{l.startTime}–{l.endTime}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => approveLeave(l.id, "approve")}>
                              <CheckCircle className="size-4" />
                              Duyệt
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => approveLeave(l.id, "reject")}>
                              <XCircle className="size-4" />
                              Từ chối
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {pendingChildren.length === 0 && pendingLeaves.length === 0 && (
              <p className="text-sm text-muted-foreground">Không có yêu cầu chờ duyệt</p>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Declare child dialog */}
      <Dialog open={childDialog} onOpenChange={setChildDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Khai báo con</DialogTitle>
            <DialogDescription>
              Sau khi quản lý duyệt, bạn có thể đăng ký nghỉ thai sản nếu con dưới 1 tuổi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ngày sinh con</Label>
              <Popover>
                <PopoverTrigger className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm hover:bg-muted">
                  <CalendarIcon className="size-4 text-muted-foreground" />
                  {childBirth ? format(childBirth, "MMM d, yyyy") : "Chọn ngày"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={childBirth}
                    onSelect={setChildBirth}
                    disabled={(d) => d > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Tên con (tuỳ chọn)</Label>
              <Input value={childName} onChange={(e) => setChildName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Textarea value={childNote} onChange={(e) => setChildNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChildDialog(false)}>Huỷ</Button>
            <Button onClick={declareChild} disabled={submitting}>Gửi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maternity leave log dialog */}
      <Dialog open={leaveDialog} onOpenChange={setLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đăng ký nghỉ thai sản</DialogTitle>
            <DialogDescription>
              Mỗi ngày được nghỉ sớm hoặc đi muộn 1 tiếng.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ngày</Label>
              <Popover>
                <PopoverTrigger className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm hover:bg-muted">
                  <CalendarIcon className="size-4 text-muted-foreground" />
                  {leaveDate ? format(leaveDate, "MMM d, yyyy") : "Chọn ngày"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={leaveDate} onSelect={setLeaveDate} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Hình thức</Label>
              <Select value={leaveMode} onValueChange={(v) => setLeaveMode(v as "EARLY_LEAVE" | "LATE_ARRIVAL")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EARLY_LEAVE">Về sớm 1 tiếng</SelectItem>
                  <SelectItem value="LATE_ARRIVAL">Đi muộn 1 tiếng</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Giờ bắt đầu</Label>
                <Input type="time" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Giờ kết thúc</Label>
                <Input type="time" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Textarea value={leaveNote} onChange={(e) => setLeaveNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveDialog(false)}>Huỷ</Button>
            <Button onClick={logLeave} disabled={submitting}>Gửi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
