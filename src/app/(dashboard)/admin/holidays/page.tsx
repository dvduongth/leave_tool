"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useT } from "@/lib/i18n/provider";

interface Holiday {
  id: string;
  date: string;
  name: string;
  year: number;
}

export default function AdminHolidaysPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formDate, setFormDate] = useState<Date | undefined>(undefined);
  const [formName, setFormName] = useState("");

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/holidays?year=${year}`);
      if (res.ok) {
        setHolidays(await res.json());
      } else {
        toast.error(t("admin.holidays.errLoadFailed"));
      }
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (role === "ADMIN") {
      fetchHolidays();
    }
  }, [role, fetchHolidays]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formDate || !formName) {
      toast.error(t("admin.holidays.errDateNameRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Send as local date string YYYY-MM-DD so the server doesn't shift it
          // via UTC conversion. (toISOString() would turn Apr 27 00:00 VN into
          // Apr 26 17:00 UTC, which Postgres stores as Apr 26.)
          date: `${formDate.getFullYear()}-${String(
            formDate.getMonth() + 1
          ).padStart(2, "0")}-${String(formDate.getDate()).padStart(2, "0")}`,
          name: formName,
          year: parseInt(year, 10),
        }),
      });
      if (res.ok) {
        toast.success(t("admin.holidays.toastCreated"));
        setDialogOpen(false);
        setFormDate(undefined);
        setFormName("");
        fetchHolidays();
      } else {
        const data = await res.json();
        toast.error(data.error || t("admin.holidays.errCreate"));
      }
    } catch {
      toast.error(t("common.unexpectedError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/holidays?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(t("admin.holidays.toastDeleted"));
        setDeleteConfirmId(null);
        fetchHolidays();
      } else {
        const data = await res.json();
        toast.error(data.error || t("admin.holidays.errDelete"));
      }
    } catch {
      toast.error(t("common.unexpectedError"));
    }
  }

  if (role !== "ADMIN") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-lg text-muted-foreground">{t("common.accessDenied")}</p>
      </div>
    );
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) =>
    String(currentYear - 2 + i)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.holidays.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.holidays.subtitle")}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" data-icon="inline-start" />
          {t("admin.holidays.add")}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={year} onValueChange={(val) => setYear(val as string)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.holidays.colDate")}</TableHead>
              <TableHead>{t("admin.holidays.colName")}</TableHead>
              <TableHead className="w-20">{t("admin.holidays.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : holidays.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("admin.holidays.empty")}
                </TableCell>
              </TableRow>
            ) : (
              holidays.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>
                    {format(new Date(h.date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>{h.name}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmId(h.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Holiday Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.holidays.addTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.holidays.addDesc").replace("{year}", year)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("admin.holidays.colDate")}</Label>
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
            <div className="space-y-2">
              <Label htmlFor="holiday-name">{t("admin.holidays.name")}</Label>
              <Input
                id="holiday-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("admin.holidays.namePlaceholder")}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? t("admin.holidays.creating") : t("common.create")}
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
            <DialogTitle>{t("admin.holidays.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.holidays.deleteDesc")}
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
