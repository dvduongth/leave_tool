"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format, startOfWeek, addDays } from "date-fns";
import { toast } from "sonner";
import { Plus, Trash2, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useT } from "@/lib/i18n/provider";
import { fetchWithRetry } from "@/lib/fetch-retry";

interface FridayOverride {
  id: string;
  weekStart: string;
  note: string | null;
  createdBy: string;
  createdAt: string;
  creator: { id: string; name: string };
}

function getMondayOfWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export default function AdminFridayOverridePage() {
  const t = useT();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [overrides, setOverrides] = useState<FridayOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formDate, setFormDate] = useState<Date | undefined>(undefined);
  const [formNote, setFormNote] = useState("");
  const [dateOpen, setDateOpen] = useState(false);

  const fetchOverrides = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/friday-override");
      if (res.ok) {
        setOverrides(await res.json());
      } else {
        toast.error(t("admin.fridayOverride.errLoadFailed"));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (role === "ADMIN" || role === "HEAD") {
      fetchOverrides();
    }
  }, [role, fetchOverrides]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formDate) {
      toast.error(t("admin.fridayOverride.errDateRequired"));
      return;
    }

    const monday = getMondayOfWeek(formDate);

    setSubmitting(true);
    try {
      const res = await fetchWithRetry("/api/friday-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: `${monday.getFullYear()}-${String(
            monday.getMonth() + 1
          ).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`,
          note: formNote || null,
        }),
      });
      if (res.ok) {
        toast.success(t("admin.fridayOverride.toastCreated"));
        setDialogOpen(false);
        setFormDate(undefined);
        setFormNote("");
        fetchOverrides();
      } else {
        const data = await res.json();
        toast.error(data.error || t("admin.fridayOverride.errCreate"));
      }
    } catch {
      toast.error("Kết nối thất bại sau 3 lần thử, vui lòng thử lại");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetchWithRetry(`/api/friday-override/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(t("admin.fridayOverride.toastDeleted"));
        setDeleteConfirmId(null);
        fetchOverrides();
      } else {
        const data = await res.json();
        toast.error(data.error || t("admin.fridayOverride.errDelete"));
      }
    } catch {
      toast.error("Kết nối thất bại sau 3 lần thử, vui lòng thử lại");
    }
  }

  if (role !== "ADMIN" && role !== "HEAD") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-lg text-muted-foreground">{t("common.accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.fridayOverride.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.fridayOverride.subtitle")}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" data-icon="inline-start" />
          {t("admin.fridayOverride.add")}
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.fridayOverride.colWeek")}</TableHead>
              <TableHead>{t("admin.fridayOverride.colFriday")}</TableHead>
              <TableHead>{t("admin.fridayOverride.colNote")}</TableHead>
              <TableHead>{t("admin.fridayOverride.colCreator")}</TableHead>
              <TableHead className="w-20">{t("common.actions")}</TableHead>
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
            ) : overrides.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("admin.fridayOverride.empty")}
                </TableCell>
              </TableRow>
            ) : (
              overrides.map((o) => {
                const monday = new Date(o.weekStart);
                const friday = addDays(monday, 4);
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      {format(monday, "MMM d")} - {format(addDays(monday, 6), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {format(friday, "EEEE, MMM d")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.note || "-"}
                    </TableCell>
                    <TableCell>{o.creator.name}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirmId(o.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Override Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.fridayOverride.addTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.fridayOverride.addDesc")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("admin.fridayOverride.selectWeek")}</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger
                  className="inline-flex h-9 w-full items-center justify-start gap-2 rounded-lg border border-input bg-transparent px-3 text-sm text-left font-normal text-muted-foreground hover:bg-muted"
                >
                  <CalendarIcon className="size-4" />
                  {formDate
                    ? `${format(getMondayOfWeek(formDate), "MMM d")} - ${format(
                        addDays(getMondayOfWeek(formDate), 6),
                        "MMM d, yyyy"
                      )}`
                    : t("admin.fridayOverride.pickWeek")}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formDate}
                    onSelect={(date) => { setFormDate(date ?? undefined); setDateOpen(false); }}
                  />
                </PopoverContent>
              </Popover>
              {formDate && (
                <p className="text-sm text-muted-foreground">
                  {t("admin.fridayOverride.fridayWillBe")}{" "}
                  <span className="font-medium">
                    {format(addDays(getMondayOfWeek(formDate), 4), "EEEE, MMM d, yyyy")}
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-note">{t("admin.fridayOverride.note")}</Label>
              <Input
                id="override-note"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder={t("admin.fridayOverride.notePlaceholder")}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? t("common.creating") : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("admin.fridayOverride.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.fridayOverride.deleteDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
