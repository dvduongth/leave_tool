"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";

// Generate 15-minute time slots from 07:00 to 19:00
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 7; h <= 19; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 19 && m > 0) break;
      slots.push(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
      );
    }
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

interface BalanceInfo {
  totalHours: number;
  usedHours: number;
  pendingHours: number;
  remainingHours: number;
}

interface PreviewResult {
  endDate: string;
  endTime: string;
  dailyBreakdown: { date: string; hours: number }[];
}

export default function NewLeavePage() {
  const router = useRouter();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("08:00");
  const [totalHours, setTotalHours] = useState("8");
  const [reason, setReason] = useState("");
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch balance on mount
  useEffect(() => {
    fetch("/api/leaves/balance")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setBalance(data);
      })
      .catch(() => {});
  }, []);

  // Preview calculation when inputs change
  useEffect(() => {
    if (!startDate || !startTime || !totalHours || Number(totalHours) <= 0)
      return;

    const params = new URLSearchParams({
      startDate: startDate.toISOString(),
      startTime,
      totalHours,
    });

    fetch(`/api/leaves/preview?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setPreview(data);
      })
      .catch(() => setPreview(null));
  }, [startDate, startTime, totalHours]);

  const parsedHours = useMemo(() => {
    const n = parseFloat(totalHours);
    return isNaN(n) || n <= 0 ? 0 : n;
  }, [totalHours]);

  async function handleSave(submitAfter: boolean) {
    if (!startDate || parsedHours <= 0) {
      toast.error("Please fill in the start date and hours.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          startTime,
          totalHours: parsedHours,
          reason: reason || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to create leave request.");
        return;
      }

      const created = await res.json();

      if (submitAfter) {
        const submitRes = await fetch(`/api/leaves/${created.id}/submit`, {
          method: "POST",
        });
        if (!submitRes.ok) {
          const err = await submitRes.json().catch(() => ({}));
          toast.error(
            err.error || "Leave saved but failed to submit for approval."
          );
          router.push("/leaves");
          return;
        }
        toast.success("Leave submitted for approval.");
      } else {
        toast.success("Leave saved as draft.");
      }

      router.push("/leaves");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/leaves")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Leave Request</h1>
          <p className="text-sm text-muted-foreground">
            Create a new leave request
          </p>
        </div>
      </div>

      {/* Balance info */}
      {balance && (
        <Card>
          <CardHeader>
            <CardTitle>Leave Balance</CardTitle>
            <CardDescription>Current cycle</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{balance.remainingHours}h</p>
                <p className="text-xs text-muted-foreground">Remaining</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">
                  {balance.usedHours}h
                </p>
                <p className="text-xs text-muted-foreground">Used</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">
                  {balance.pendingHours}h
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Start Date */}
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger
                className="flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm hover:bg-muted"
              >
                <CalendarIcon className="size-4 text-muted-foreground" />
                {startDate ? (
                  format(startDate, "EEEE, MMMM d, yyyy")
                ) : (
                  <span className="text-muted-foreground">Pick a date</span>
                )}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => setStartDate(date ?? undefined)}
                  disabled={(date) => {
                    const day = date.getDay();
                    return day === 0 || day === 6 || date < new Date(new Date().setHours(0, 0, 0, 0));
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Start Time */}
          <div className="space-y-2">
            <Label>Start Time</Label>
            <Select value={startTime} onValueChange={(val) => setStartTime(val as string)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Total Hours */}
          <div className="space-y-2">
            <Label>Total Hours</Label>
            <Input
              type="number"
              min="0.25"
              step="0.25"
              value={totalHours}
              onChange={(e) => setTotalHours(e.target.value)}
              placeholder="8"
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>
              Reason <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Brief reason for your leave..."
              rows={3}
            />
          </div>

          {/* Preview */}
          {preview && startDate && (
            <>
              <Separator />
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Preview</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Start:</span>{" "}
                    {format(startDate, "MMM d, yyyy")} {startTime}
                  </div>
                  <div>
                    <span className="text-muted-foreground">End:</span>{" "}
                    {format(new Date(preview.endDate), "MMM d, yyyy")}{" "}
                    {preview.endTime}
                  </div>
                </div>
                {preview.dailyBreakdown.length > 1 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Daily breakdown:</p>
                    {preview.dailyBreakdown.map((day, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-xs text-muted-foreground"
                      >
                        <span>{format(new Date(day.date), "EEE, MMM d")}</span>
                        <span>{day.hours}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button
          variant="outline"
          disabled={submitting}
          onClick={() => handleSave(false)}
        >
          Save as Draft
        </Button>
        <Button disabled={submitting} onClick={() => handleSave(true)}>
          Submit for Approval
        </Button>
      </div>
    </div>
  );
}
