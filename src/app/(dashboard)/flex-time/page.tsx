"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, CalendarIcon, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";

interface FlexRecord {
  id: string;
  type: string;
  date: string;
  minutes: number;
  reason: string | null;
  status: string;
  employee?: { id: string; name: string };
}

interface FlexSummary {
  totalDeficit: number;
  totalMakeup: number;
  remaining: number;
  status: string;
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

export default function FlexTimePage() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isApprover = userRole === "MANAGER" || userRole === "HEAD";

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [month, setMonth] = useState(defaultMonth);
  const [records, setRecords] = useState<FlexRecord[]>([]);
  const [summary, setSummary] = useState<FlexSummary | null>(null);
  const [pendingRecords, setPendingRecords] = useState<FlexRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogType, setDialogType] = useState<"DEFICIT" | "MAKEUP" | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState<Date | undefined>(undefined);
  const [formMinutes, setFormMinutes] = useState("");
  const [formReason, setFormReason] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [recordsRes, summaryRes] = await Promise.all([
        fetch(`/api/flex-time?month=${month}`),
        fetch(`/api/flex-time/summary?month=${month}`),
      ]);

      if (recordsRes.ok) {
        const data = await recordsRes.json();
        setRecords(data.records || []);
      }
      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
    } catch {
      toast.error("Failed to load flex time data");
    } finally {
      setLoading(false);
    }
  }, [month]);

  const fetchPending = useCallback(async () => {
    if (!isApprover) return;
    try {
      // Fetch pending records from team
      const res = await fetch(`/api/flex-time?month=${month}`);
      if (res.ok) {
        const data = await res.json();
        const pending = (data.records || []).filter(
          (r: FlexRecord) => r.status === "PENDING" && r.employee
        );
        setPendingRecords(pending);
      }
    } catch {
      // ignore
    }
  }, [month, isApprover]);

  useEffect(() => {
    fetchData();
    fetchPending();
  }, [fetchData, fetchPending]);

  const deficitRecords = records.filter((r) => r.type === "DEFICIT");
  const makeupRecords = records.filter((r) => r.type === "MAKEUP");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formDate || !formMinutes) {
      toast.error("Date and minutes are required");
      return;
    }
    const minutes = parseInt(formMinutes, 10);
    if (isNaN(minutes) || minutes <= 0) {
      toast.error("Minutes must be a positive number");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/flex-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: dialogType,
          date: formDate.toISOString(),
          minutes,
          reason: formReason || null,
        }),
      });
      if (res.ok) {
        toast.success(
          dialogType === "DEFICIT"
            ? "Late arrival recorded"
            : "Makeup time recorded"
        );
        setDialogType(null);
        setFormDate(undefined);
        setFormMinutes("");
        setFormReason("");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create record");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApproval(recordId: string, action: "APPROVED" | "REJECTED") {
    try {
      const res = await fetch("/api/flex-time/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, action }),
      });
      if (res.ok) {
        toast.success(`Record ${action.toLowerCase()}`);
        fetchData();
        fetchPending();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to process approval");
      }
    } catch {
      toast.error("An unexpected error occurred");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flex Time</h1>
          <p className="text-sm text-muted-foreground">
            Track late arrivals and makeup time
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDialogType("DEFICIT")}>
            <Plus className="size-4" data-icon="inline-start" />
            Record Late Arrival
          </Button>
          <Button onClick={() => setDialogType("MAKEUP")}>
            <Plus className="size-4" data-icon="inline-start" />
            Record Makeup
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-48"
        />
      </div>

      {/* Monthly Summary */}
      {summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Monthly Summary</CardTitle>
            <CardDescription>
              {month} - Status:{" "}
              <Badge variant={summary.status === "OPEN" ? "secondary" : "default"}>
                {summary.status}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Deficit</p>
                <p className="text-xl font-semibold">{summary.totalDeficit}m</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Makeup</p>
                <p className="text-xl font-semibold">{summary.totalMakeup}m</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="text-xl font-semibold">{summary.remaining}m</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-xl font-semibold">{summary.status}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Records Tabs */}
      <Tabs defaultValue="deficit">
        <TabsList>
          <TabsTrigger value="deficit">
            Deficit Records ({deficitRecords.length})
          </TabsTrigger>
          <TabsTrigger value="makeup">
            Makeup Records ({makeupRecords.length})
          </TabsTrigger>
          {isApprover && (
            <TabsTrigger value="pending">
              Pending Approvals ({pendingRecords.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="deficit">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Minutes</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : deficitRecords.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No deficit records this month.
                    </TableCell>
                  </TableRow>
                ) : (
                  deficitRecords.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {format(new Date(r.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">{r.minutes}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {r.reason || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(r.status)}>
                          {r.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="makeup">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Minutes</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : makeupRecords.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No makeup records this month.
                    </TableCell>
                  </TableRow>
                ) : (
                  makeupRecords.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {format(new Date(r.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">{r.minutes}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {r.reason || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(r.status)}>
                          {r.status}
                        </Badge>
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
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Minutes</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRecords.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No pending records to review.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingRecords.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {r.employee?.name ?? "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              r.type === "DEFICIT" ? "destructive" : "default"
                            }
                          >
                            {r.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(r.date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.minutes}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[150px] truncate">
                          {r.reason || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleApproval(r.id, "APPROVED")
                              }
                            >
                              <CheckCircle className="size-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleApproval(r.id, "REJECTED")
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

      {/* Add Record Dialog */}
      <Dialog
        open={dialogType !== null}
        onOpenChange={() => setDialogType(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogType === "DEFICIT"
                ? "Record Late Arrival"
                : "Record Makeup Time"}
            </DialogTitle>
            <DialogDescription>
              {dialogType === "DEFICIT"
                ? "Log a late arrival or early departure."
                : "Log makeup time to offset a deficit."}
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
            <div className="space-y-2">
              <Label htmlFor="flex-minutes">Minutes</Label>
              <Input
                id="flex-minutes"
                type="number"
                min="1"
                value={formMinutes}
                onChange={(e) => setFormMinutes(e.target.value)}
                placeholder="e.g. 15"
                required
              />
            </div>
            {dialogType === "DEFICIT" && (
              <div className="space-y-2">
                <Label htmlFor="flex-reason">Reason</Label>
                <Textarea
                  id="flex-reason"
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Why were you late?"
                  rows={3}
                />
              </div>
            )}
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
