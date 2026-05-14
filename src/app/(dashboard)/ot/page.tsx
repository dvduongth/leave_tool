"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, CalendarIcon, Clock, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import { useT } from "@/lib/i18n/provider";

interface OTRecord {
  id: string;
  date: string;
  otStart: string;
  otEnd: string;
  otMinutes: number;
  status: string;
  note: string | null;
  employee?: { id: string; name: string };
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

function getStatusVariant(status: string) {
  switch (status) {
    case "APPROVED":
      return "default";
    case "REJECTED":
      return "destructive";
    default:
      return "secondary";
  }
}

export default function OTPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const isApprover = role === "MANAGER" || role === "HEAD" || role === "ADMIN";

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [month, setMonth] = useState(defaultMonth);
  const [records, setRecords] = useState<OTRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("ALL");

  // Form state
  const [formDate, setFormDate] = useState<Date | undefined>(undefined);
  const [formDateOpen, setFormDateOpen] = useState(false);
  const [formStart, setFormStart] = useState("18:00");
  const [formEnd, setFormEnd] = useState("20:00");
  const [formNote, setFormNote] = useState("");

  interface OTBalanceCycle {
    cycleYear: number;
    cycleStart: string;
    cycleEnd: string;
    graceDeadline: string;
    totalMinutes: number;
    usedMinutes: number;
    pendingMinutes: number;
    remainingMinutes: number;
  }
  interface OTBankInfo {
    current: OTBalanceCycle;
    grace: OTBalanceCycle | null;
    totalRemainingMinutes: number;
  }
  const [bank, setBank] = useState<OTBankInfo | null>(null);

  // Fetch team members for filter
  useEffect(() => {
    if (isApprover) {
      fetch("/api/team-members")
        .then((r) => (r.ok ? r.json() : { members: [] }))
        .then((data) => setTeamMembers(data.members || []))
        .catch(() => setTeamMembers([]));
    }
  }, [isApprover]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month });
      if (isApprover && selectedEmployeeId !== "ALL") {
        params.set("employeeId", selectedEmployeeId);
      }
      const res = await fetch(`/api/ot?${params.toString()}`);
      if (res.ok) {
        setRecords(await res.json());
      } else {
        toast.error(t("ot.errLoadFailed"));
      }
    } finally {
      setLoading(false);
    }
  }, [month, isApprover, selectedEmployeeId, t]);

  const fetchBank = useCallback(async () => {
    try {
      const res = await fetch("/api/ot/balance");
      if (res.ok) setBank(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    fetchBank();
  }, [fetchBank]);

  const myRecords = records.filter(
    (r) => !r.employee || r.employee.id === userId
  );
  const isAdmin = role === "ADMIN";
  const teamRecords = records.filter(
    (r) => r.employee && r.employee.id !== userId
  );
  const pendingTeamRecords = teamRecords.filter(
    (r) => r.status === "PENDING"
  );

  const totalMinutes = myRecords.reduce((sum, r) => sum + r.otMinutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formDate) {
      toast.error(t("ot.errDateRequired"));
      return;
    }
    if (!formStart || !formEnd) {
      toast.error(t("ot.errTimesRequired"));
      return;
    }
    if (!formNote.trim()) {
      toast.error("Vui lòng nhập lý do");
      return;
    }
    setSubmitting(true);
    try {
      // Send date as YYYY-MM-DD to avoid timezone shift
      const dateStr = `${formDate.getFullYear()}-${String(formDate.getMonth() + 1).padStart(2, "0")}-${String(formDate.getDate()).padStart(2, "0")}`;
      const res = await fetch("/api/ot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          otStart: formStart,
          otEnd: formEnd,
          note: formNote.trim(),
        }),
      });
      if (res.ok) {
        toast.success(t("ot.toastCreated"));
        setDialogOpen(false);
        setFormDate(undefined);
        setFormStart("18:00");
        setFormEnd("20:00");
        setFormNote("");
        fetchRecords();
      } else {
        const data = await res.json();
        toast.error(data.error || t("ot.errCreateFailed"));
      }
    } catch {
      toast.error(t("common.unexpectedError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelOwn(recordId: string) {
    if (!confirm("Bạn có chắc muốn huỷ yêu cầu OT này?")) return;
    try {
      const res = await fetch(`/api/ot/${recordId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Đã huỷ yêu cầu");
        fetchRecords();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Không huỷ được");
      }
    } catch {
      toast.error(t("common.unexpectedError"));
    }
  }

  async function handleApproval(
    recordId: string,
    action: "approve" | "reject"
  ) {
    try {
      const res = await fetch(`/api/ot/${recordId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ comment: "" }) : undefined,
      });
      if (res.ok) {
        toast.success(
          action === "approve"
            ? t("ot.toastApproved")
            : t("ot.toastRejected")
        );
        fetchRecords();
        fetchBank();
      } else {
        const data = await res.json();
        toast.error(data.error || t("ot.errActionFailed"));
      }
    } catch {
      toast.error(t("common.unexpectedError"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("ot.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("ot.subtitle")}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" data-icon="inline-start" />
          {t("ot.recordOT")}
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-48"
        />
        {isApprover && teamMembers.length > 0 && (
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
        <Card className="flex-1">
          <CardContent className="flex items-center gap-2 py-3">
            <Clock className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t("ot.monthlyTotal")}</span>
            <span className="text-sm">
              {t("ot.totalFormat")
                .replace("{h}", String(totalHours))
                .replace("{m}", String(remainingMinutes))
                .replace("{total}", String(totalMinutes))}
            </span>
          </CardContent>
        </Card>
      </div>

      {bank && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Clock className="size-4 text-muted-foreground" />
              OT Bank
            </div>
            <div>
              <span className="text-muted-foreground">Current cycle {bank.current.cycleYear}:</span>{" "}
              <span className="font-mono">{bank.current.remainingMinutes} phút</span>{" "}
              <span className="text-muted-foreground text-xs">
                (hết hạn {bank.current.graceDeadline})
              </span>
            </div>
            {bank.grace && (
              <div>
                <span className="text-muted-foreground">Grace cycle {bank.grace.cycleYear}:</span>{" "}
                <span className="font-mono">{bank.grace.remainingMinutes} phút</span>{" "}
                <span className="text-amber-600 text-xs">
                  (hết hạn {bank.grace.graceDeadline})
                </span>
              </div>
            )}
            <div className="ml-auto font-semibold">
              Tổng khả dụng: <span className="font-mono">{bank.totalRemainingMinutes} phút</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">{t("ot.tabMine")}</TabsTrigger>
          {isApprover && (
            <>
              <TabsTrigger value="pending">
                {t("ot.tabPending").replace(
                  "{count}",
                  String(pendingTeamRecords.length)
                )}
              </TabsTrigger>
              <TabsTrigger value="team">
                Team ({teamRecords.length})
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="mine">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("ot.colDate")}</TableHead>
                  <TableHead>{t("ot.colOtStart")}</TableHead>
                  <TableHead>{t("ot.colOtEnd")}</TableHead>
                  <TableHead className="text-right">
                    {t("ot.colMinutes")}
                  </TableHead>
                  <TableHead>{t("ot.colStatus")}</TableHead>
                  <TableHead>{t("ot.colNote")}</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : myRecords.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t("ot.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  myRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {format(new Date(record.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{record.otStart}</TableCell>
                      <TableCell>{record.otEnd}</TableCell>
                      <TableCell className="text-right">
                        {record.otMinutes}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(record.status)}>
                          {t(`common.status.${record.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {record.note || "-"}
                      </TableCell>
                      <TableCell>
                        {record.status === "PENDING" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleCancelOwn(record.id)}
                            title="Huỷ yêu cầu"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {isApprover && (
          <>
          <TabsContent value="pending">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("ot.colEmployee")}</TableHead>
                    <TableHead>{t("ot.colDate")}</TableHead>
                    <TableHead>{t("ot.colOtStart")}</TableHead>
                    <TableHead>{t("ot.colOtEnd")}</TableHead>
                    <TableHead className="text-right">
                      {t("ot.colMinutes")}
                    </TableHead>
                    <TableHead>{t("ot.colNote")}</TableHead>
                    <TableHead>{t("ot.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTeamRecords.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {t("ot.emptyPending")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingTeamRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {record.employee?.name ?? "-"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(record.date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{record.otStart}</TableCell>
                        <TableCell>{record.otEnd}</TableCell>
                        <TableCell className="text-right">
                          {record.otMinutes}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[150px] truncate">
                          {record.note || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleApproval(record.id, "approve")
                              }
                            >
                              <CheckCircle className="size-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleApproval(record.id, "reject")
                              }
                            >
                              <XCircle className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="team">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("ot.colEmployee")}</TableHead>
                    <TableHead>{t("ot.colDate")}</TableHead>
                    <TableHead>{t("ot.colOtStart")}</TableHead>
                    <TableHead>{t("ot.colOtEnd")}</TableHead>
                    <TableHead className="text-right">
                      {t("ot.colMinutes")}
                    </TableHead>
                    <TableHead>{t("ot.colStatus")}</TableHead>
                    <TableHead>{t("ot.colNote")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamRecords.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Không có dữ liệu OT của team
                      </TableCell>
                    </TableRow>
                  ) : (
                    teamRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {record.employee?.name ?? "-"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(record.date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{record.otStart}</TableCell>
                        <TableCell>{record.otEnd}</TableCell>
                        <TableCell className="text-right">
                          {record.otMinutes}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(record.status)}>
                            {t(`common.status.${record.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[150px] truncate">
                          {record.note || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          </>
        )}
      </Tabs>

      {/* Record OT Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("ot.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("ot.dialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("ot.colDate")}</Label>
              <Popover open={formDateOpen} onOpenChange={setFormDateOpen}>
                <PopoverTrigger
                  className="inline-flex h-9 w-full items-center justify-start gap-2 rounded-lg border border-input bg-transparent px-3 text-sm text-left font-normal text-muted-foreground hover:bg-muted"
                >
                  <CalendarIcon className="size-4" />
                  {formDate
                    ? format(formDate, "MMM d, yyyy")
                    : t("common.pickDate")}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formDate}
                    onSelect={(date) => {
                      setFormDate(date ?? undefined);
                      setFormDateOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ot-start">{t("ot.startTime")}</Label>
                <Input
                  id="ot-start"
                  type="time"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ot-end">{t("ot.endTime")}</Label>
                <Input
                  id="ot-end"
                  type="time"
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ot-note">
                {t("ot.noteOptional")} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="ot-note"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder={t("ot.notePlaceholder")}
                rows={3}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? t("common.saving") : t("common.submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
