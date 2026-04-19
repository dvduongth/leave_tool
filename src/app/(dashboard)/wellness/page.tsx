"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, Heart, Trash2, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useT } from "@/lib/i18n/provider";

interface MenstrualRecord {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string | null;
}

interface Summary {
  thisMonthUsed: number;
  maxPerMonth: number;
  durationMinutes: number;
}

function addMinutesToHHMM(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function WellnessPage() {
  const t = useT();
  const { data: session } = useSession();
  const gender = (session?.user as { gender?: string } | undefined)?.gender;
  const isFemale = gender === "FEMALE";

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;

  const [month, setMonth] = useState(defaultMonth);
  const [records, setRecords] = useState<MenstrualRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formDate, setFormDate] = useState<Date | undefined>(undefined);
  const [formStart, setFormStart] = useState("10:00");
  const [formNote, setFormNote] = useState("");

  const fetchRecords = useCallback(async () => {
    if (!isFemale) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/menstrual-leave?month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records);
        setSummary(data.summary);
      } else {
        toast.error(t("wellness.errLoad"));
      }
    } finally {
      setLoading(false);
    }
  }, [month, isFemale, t]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formDate) {
      toast.error(t("wellness.errDateRequired"));
      return;
    }
    if (!summary) {
      toast.error(t("common.unexpectedError"));
      return;
    }
    setSubmitting(true);
    try {
      const dateStr = `${formDate.getFullYear()}-${String(
        formDate.getMonth() + 1
      ).padStart(2, "0")}-${String(formDate.getDate()).padStart(2, "0")}`;
      const endTime = addMinutesToHHMM(formStart, summary.durationMinutes);
      const res = await fetch("/api/menstrual-leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          startTime: formStart,
          endTime,
          note: formNote || null,
        }),
      });
      if (res.ok) {
        toast.success(t("wellness.toastCreated"));
        setDialogOpen(false);
        setFormDate(undefined);
        setFormStart("10:00");
        setFormNote("");
        fetchRecords();
      } else {
        const data = await res.json();
        toast.error(data.error || t("wellness.errCreateFailed"));
      }
    } catch {
      toast.error(t("common.unexpectedError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("wellness.confirmDelete"))) return;
    try {
      const res = await fetch(`/api/menstrual-leave/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(t("wellness.toastDeleted"));
        fetchRecords();
      } else {
        const data = await res.json();
        toast.error(data.error || t("wellness.errDeleteFailed"));
      }
    } catch {
      toast.error(t("common.unexpectedError"));
    }
  }

  if (!isFemale) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold">{t("wellness.title")}</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {t("wellness.onlyFemale")}
        </p>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limitReached =
    summary != null && summary.thisMonthUsed >= summary.maxPerMonth;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("wellness.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("wellness.subtitle")}
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          disabled={limitReached}
          title={limitReached ? t("wellness.errLimitReached") : undefined}
        >
          <Plus className="size-4" data-icon="inline-start" />
          {t("wellness.recordButton")}
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
            <Heart className="size-4 text-pink-500" />
            <span className="text-sm font-medium">
              {t("wellness.monthlyCounter")}
            </span>
            <span className="text-sm">
              {summary
                ? t("wellness.monthlyFormat")
                    .replace("{used}", String(summary.thisMonthUsed))
                    .replace("{max}", String(summary.maxPerMonth))
                    .replace("{mins}", String(summary.durationMinutes))
                : "…"}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("wellness.historyTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("wellness.colDate")}</TableHead>
                  <TableHead>{t("wellness.colStart")}</TableHead>
                  <TableHead>{t("wellness.colEnd")}</TableHead>
                  <TableHead>{t("wellness.colNote")}</TableHead>
                  <TableHead className="text-right">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t("wellness.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((r) => {
                    const recordDate = new Date(r.date);
                    const canDelete = recordDate >= today;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          {format(recordDate, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{r.startTime}</TableCell>
                        <TableCell>{r.endTime}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[240px] truncate">
                          {r.note || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(r.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{t("wellness.dialogTitle")}</DialogTitle>
              <DialogDescription>
                {summary
                  ? t("wellness.dialogDesc").replace(
                      "{mins}",
                      String(summary.durationMinutes)
                    )
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("wellness.fieldDate")}</Label>
                <Popover>
                  <PopoverTrigger className="inline-flex h-9 w-full items-center justify-start gap-2 rounded-lg border border-input bg-transparent px-3 text-sm text-left font-normal text-muted-foreground hover:bg-muted">
                    <CalendarIcon className="size-4" />
                    {formDate
                      ? format(formDate, "MMM d, yyyy")
                      : t("common.pickDate")}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formDate}
                      onSelect={setFormDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{t("wellness.fieldStart")}</Label>
                <Input
                  type="time"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                />
                {summary && (
                  <p className="text-xs text-muted-foreground">
                    {t("wellness.endAutoHint")
                      .replace("{mins}", String(summary.durationMinutes))
                      .replace(
                        "{end}",
                        addMinutesToHHMM(formStart, summary.durationMinutes)
                      )}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>
                  {t("wellness.fieldNote")}{" "}
                  <span className="text-xs text-muted-foreground">
                    {t("common.optional")}
                  </span>
                </Label>
                <Textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {t("common.cancel")}
              </Button>
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
