"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Calendar,
  Clock,
  AlertTriangle,
  Users,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DashboardData {
  balance: {
    totalHours: number;
    usedHours: number;
    pendingHours: number;
    remainingHours: number;
    graceBalance: {
      totalHours: number;
      usedHours: number;
      remainingHours: number;
      graceDeadline: string;
    } | null;
  } | null;
  flexTime: {
    totalDeficit: number;
    totalMakeup: number;
    remaining: number;
    status: string;
    yearMonth: string;
  };
  recentLeaves: {
    id: string;
    startDate: string;
    endDate: string;
    totalHours: number;
    status: string;
    reason: string | null;
    createdAt: string;
  }[];
  pendingCount: number;
  todayAbsences: { id: string; name: string; totalHours: number }[];
  teamOrDeptSize: number;
  totalEmployees: number | null;
  alerts: { type: string; message: string }[];
  role: string;
  userName: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        Loading dashboard...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-48 items-center justify-center text-destructive">
        Failed to load dashboard data.
      </div>
    );
  }

  const isManagerOrHead =
    data.role === "MANAGER" || data.role === "HEAD";
  const isAdmin = data.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {data.userName}</h1>
        <p className="text-sm text-muted-foreground">
          Role:{" "}
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {data.role}
          </span>
        </p>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.alerts.map((alert, i) => (
            <Card key={i} className="border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-950/20">
              <CardContent className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-600" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {alert.message}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Leave Balance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              Leave Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.balance ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">
                    {data.balance.totalHours}h
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Used</span>
                  <span className="font-medium">
                    {data.balance.usedHours}h
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-bold text-primary">
                    {data.balance.remainingHours}h
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, (data.balance.usedHours / data.balance.totalHours) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {Math.round(
                    (data.balance.usedHours / data.balance.totalHours) * 100
                  )}
                  % used
                </p>
                {data.balance.graceBalance && (
                  <div className="mt-2 rounded-md border border-dashed p-2">
                    <p className="text-xs font-medium">Grace Period</p>
                    <p className="text-xs text-muted-foreground">
                      {data.balance.graceBalance.remainingHours}h remaining
                      (expires{" "}
                      {format(
                        new Date(data.balance.graceBalance.graceDeadline),
                        "MMM d, yyyy"
                      )}
                      )
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active balance found.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Flex Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              Flex Time Status
            </CardTitle>
            <CardDescription>{data.flexTime.yearMonth}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Deficit</span>
              <span className="font-medium">
                {data.flexTime.totalDeficit} min
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Makeup</span>
              <span className="font-medium">
                {data.flexTime.totalMakeup} min
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-bold">
                {data.flexTime.remaining} min
              </span>
            </div>
            <Badge
              variant={
                data.flexTime.status === "SETTLED"
                  ? "secondary"
                  : "default"
              }
            >
              {data.flexTime.status}
            </Badge>
          </CardContent>
        </Card>

        {/* Pending Approvals (MANAGER/HEAD/ADMIN) */}
        {(isManagerOrHead || isAdmin) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" />
                Pending Approvals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-bold">{data.pendingCount}</p>
              <p className="text-sm text-muted-foreground">
                requests awaiting your action
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/approvals")}
              >
                Review
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Today's Absences (MANAGER/HEAD/ADMIN) */}
        {(isManagerOrHead || isAdmin) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                Today&apos;s Absences
              </CardTitle>
              {isManagerOrHead && (
                <CardDescription>
                  Team size: {data.teamOrDeptSize}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {data.todayAbsences.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No one is on leave today.
                </p>
              ) : (
                <ul className="space-y-1">
                  {data.todayAbsences.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{a.name}</span>
                      <span className="text-muted-foreground">
                        {a.totalHours}h
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Company Stats (ADMIN) */}
        {isAdmin && data.totalEmployees !== null && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                Company Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Total Employees
                </span>
                <span className="font-medium">{data.totalEmployees}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">On Leave Today</span>
                <span className="font-medium">
                  {data.todayAbsences.length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Pending Requests
                </span>
                <span className="font-medium">{data.pendingCount}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Leaves */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Leaves</CardTitle>
          <CardDescription>Your last 5 leave requests</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentLeaves.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No leave requests yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentLeaves.map((leave) => (
                    <TableRow
                      key={leave.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/leaves/${leave.id}`)}
                    >
                      <TableCell>
                        {format(new Date(leave.startDate), "MMM d")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(leave.endDate), "MMM d")}
                      </TableCell>
                      <TableCell className="text-right">
                        {leave.totalHours}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            leave.status === "APPROVED"
                              ? "default"
                              : leave.status === "REJECTED"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {leave.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {leave.reason || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
