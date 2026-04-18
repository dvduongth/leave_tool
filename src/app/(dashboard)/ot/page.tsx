"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, CalendarIcon, Clock, CheckCircle, XCircle } from "lucide-react";
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

  // Form state
  const [formDate, setFormDate] = useState<Date | undefined>(undefined);
  const [formStart, setFormStart] = useState("18:00");
  const [formEnd, setFormEnd] = useState("20:00");
  const [formNote, setFormNote] = useState("");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ot?month=${month}`);
      if (res.ok) {
        setRecords(await res.json());
      } else {
        toast.error(t("ot.errLoadFailed"));
      }
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const myRecords = records.filter(
    (r) => !r.employee || r.employee.id === userId
  );
  const isAdmin = role === "ADMIN";
  const pendingTeamRecords = records.filter(
    (r) =>
      r.status === "PENDING" &&
      r.employee &&
      (isAdmin || r.employee.id !== userId)
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
          note: formNote || null,
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

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">{t("ot.tabMine")}</TabsTrigger>
          {isApprover && (
            <TabsTrigger value="pending">
              {t("ot.tabPending").replace(
                "{count}",
                String(pendingTeamRecords.length)
              )}
            </TabsTrigger>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : myRecords.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
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
              <Popover>
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
                    onSelect={(date) => setFormDate(date ?? undefined)}
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
              <Label htmlFor="ot-note">{t("ot.noteOptional")}</Label>
              <Textarea
                id="ot-note"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder={t("ot.notePlaceholder")}
                rows={3}
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
