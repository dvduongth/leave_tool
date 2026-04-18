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
import { useT } from "@/lib/i18n/provider";

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
  const t = useT();
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
        {t("dashboard.loading")}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-48 items-center justify-center text-destructive">
        {t("dashboard.loadFailed")}
      </div>
    );
  }

  const isManagerOrHead =
    data.role === "MANAGER" || data.role === "HEAD";
  const isAdmin = data.role === "ADMIN";

  const statusLabel = (s: string) => t(`common.status.${s}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t("dashboard.welcome").replace("{name}", data.userName)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.role")}:{" "}
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
              {t("dashboard.leaveBalance")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.balance ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("dashboard.total")}</span>
                  <span className="font-medium">
                    {data.balance.totalHours}h
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("dashboard.used")}</span>
                  <span className="font-medium">
                    {data.balance.usedHours}h
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("dashboard.remaining")}</span>
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
                  {t("dashboard.percentUsed").replace(
                    "{percent}",
                    String(Math.round((data.balance.usedHours / data.balance.totalHours) * 100))
                  )}
                </p>
                {data.balance.graceBalance && (
                  <div className="mt-2 rounded-md border border-dashed p-2">
                    <p className="text-xs font-medium">{t("dashboard.gracePeriod")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("dashboard.graceRemaining")
                        .replace("{hours}", String(data.balance.graceBalance.remainingHours))
                        .replace(
                          "{date}",
                          format(
                            new Date(data.balance.graceBalance.graceDeadline),
                            "MMM d, yyyy"
                          )
                        )}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("dashboard.noBalance")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Flex Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              {t("dashboard.flexTimeStatus")}
            </CardTitle>
            <CardDescription>{data.flexTime.yearMonth}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("dashboard.deficit")}</span>
              <span className="font-medium">
                {data.flexTime.totalDeficit} min
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("dashboard.makeup")}</span>
              <span className="font-medium">
                {data.flexTime.totalMakeup} min
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("dashboard.remaining")}</span>
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
              {statusLabel(data.flexTime.status)}
            </Badge>
          </CardContent>
        </Card>

        {/* Pending Approvals (MANAGER/HEAD/ADMIN) */}
        {(isManagerOrHead || isAdmin) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" />
                {t("dashboard.pendingApprovals")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-bold">{data.pendingCount}</p>
              <p className="text-sm text-muted-foreground">
                {t("dashboard.requestsAwaiting")}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/approvals")}
              >
                {t("dashboard.review")}
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
                {t("dashboard.todaysAbsences")}
              </CardTitle>
              {isManagerOrHead && (
                <CardDescription>
                  {t("dashboard.teamSize").replace(
                    "{count}",
                    String(data.teamOrDeptSize)
                  )}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {data.todayAbsences.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.noAbsencesToday")}
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
                {t("dashboard.companyStats")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("dashboard.totalEmployees")}
                </span>
                <span className="font-medium">{data.totalEmployees}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("dashboard.onLeaveToday")}</span>
                <span className="font-medium">
                  {data.todayAbsences.length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("dashboard.pendingRequests")}
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
          <CardTitle>{t("dashboard.recentLeaves")}</CardTitle>
          <CardDescription>{t("dashboard.recentLeavesDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentLeaves.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("dashboard.noLeavesYet")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dashboard.colStart")}</TableHead>
                    <TableHead>{t("dashboard.colEnd")}</TableHead>
                    <TableHead className="text-right">{t("dashboard.colHours")}</TableHead>
                    <TableHead>{t("dashboard.colStatus")}</TableHead>
                    <TableHead>{t("dashboard.colReason")}</TableHead>
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
                          {statusLabel(leave.status)}
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
