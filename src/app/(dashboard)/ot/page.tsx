"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface OTRecord {
  id: string;
  date: string;
  otStart: string;
  otEnd: string;
  otMinutes: number;
  status: string;
  note: string | null;
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
        toast.error("Failed to load OT records");
      }
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const totalMinutes = records.reduce((sum, r) => sum + r.otMinutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formDate) {
      toast.error("Date is required");
      return;
    }
    if (!formStart || !formEnd) {
      toast.error("Start and end times are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/ot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formDate.toISOString(),
          otStart: formStart,
          otEnd: formEnd,
          note: formNote || null,
        }),
      });
      if (res.ok) {
        toast.success("OT record created");
        setDialogOpen(false);
        setFormDate(undefined);
        setFormStart("18:00");
        setFormEnd("20:00");
        setFormNote("");
        fetchRecords();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create OT record");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overtime Records</h1>
          <p className="text-sm text-muted-foreground">
            Track and manage your overtime hours
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" data-icon="inline-start" />
          Record OT
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
            <span className="text-sm font-medium">Monthly Total:</span>
            <span className="text-sm">
              {totalHours}h {remainingMinutes}m ({totalMinutes} minutes)
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>OT Start</TableHead>
              <TableHead>OT End</TableHead>
              <TableHead className="text-right">Minutes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No OT records for this month.
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
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
                      {record.status}
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

      {/* Record OT Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Overtime</DialogTitle>
            <DialogDescription>
              Log your overtime work hours.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger
                  className="inline-flex h-9 w-full items-center justify-start gap-2 rounded-lg border border-input bg-transparent px-3 text-sm text-left font-normal text-muted-foreground hover:bg-muted"
                >
                  <CalendarIcon className="size-4" />
                  {formDate
                    ? format(formDate, "MMM d, yyyy")
                    : "Pick a date"}
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
                <Label htmlFor="ot-start">Start Time</Label>
                <Input
                  id="ot-start"
                  type="time"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ot-end">End Time</Label>
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
              <Label htmlFor="ot-note">Note (optional)</Label>
              <Textarea
                id="ot-note"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="What did you work on?"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
