"use client";

import { useEffect, useState, useCallback } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useT } from "@/lib/i18n/provider";

type ReportType = "daily" | "weekly" | "monthly";

interface DailyData {
  type: "daily";
  date: string;
  employees: { id: string; name: string; totalHours: number; status: string }[];
  otRecords: { id: string; name: string; otMinutes: number }[];
  summary: { totalOnLeave: number; totalOtMinutes: number };
}

interface WeeklyEmployee {
  id: string;
  name: string;
  thisWeekHours: number;
  prevWeekHours: number;
  delta: number;
  otMinutes: number;
}

interface WeeklyData {
  type: "weekly";
  weekStart: string;
  weekEnd: string;
  employees: WeeklyEmployee[];
  summary: {
    totalLeaveHours: number;
    totalOtMinutes: number;
    approvedCount: number;
    rejectedCount: number;
    approvalRate: number;
  };
  dayOfWeekHours: { day: string; hours: number }[];
}

interface DeptSummary {
  departmentId: string;
  departmentName: string;
  employeeCount: number;
  totalLeaveHours: number;
  totalOtMinutes: number;
  utilizationRate: number;
  flex: {
    totalDeficit: number;
    totalMakeup: number;
    employeesWithRemaining: number;
  };
}

interface MonthlyData {
  type: "monthly";
  monthStart: string;
  monthEnd: string;
  departments: DeptSummary[];
  topLeaveTakers: { id: string; name: string; hours: number }[];
}

interface Department {
  id: string;
  name: string;
}

export default function ReportsPage() {
  const t = useT();
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [departmentId, setDepartmentId] = useState<string>("ALL");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [data, setData] = useState<DailyData | WeeklyData | MonthlyData | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch departments for filter
  useEffect(() => {
    // We derive departments from the monthly report or just show the filter
    // For simplicity, fetch a monthly report to discover departments
    fetch(`/api/reports?type=monthly&date=${new Date().toISOString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.departments) {
          setDepartments(
            d.departments.map((dept: DeptSummary) => ({
              id: dept.departmentId,
              name: dept.departmentName,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: reportType,
        date: selectedDate.toISOString(),
      });
      if (departmentId !== "ALL") {
        params.set("departmentId", departmentId);
      }
      const res = await fetch(`/api/reports?${params.toString()}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [reportType, selectedDate, departmentId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleTabChange = (value: unknown) => {
    const types: ReportType[] = ["daily", "weekly", "monthly"];
    if (typeof value === "number" && value >= 0 && value < types.length) {
      setReportType(types[value]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("reports.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("reports.subtitle")}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Popover>
          <PopoverTrigger className="inline-flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm text-muted-foreground hover:bg-muted">
            <CalendarIcon className="size-4" />
            {format(selectedDate, "MMM d, yyyy")}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
            />
          </PopoverContent>
        </Popover>

        {departments.length > 0 && (
          <Select
            value={departmentId}
            onValueChange={(val) => setDepartmentId(val ?? "ALL")}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("reports.allDepartments")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("reports.allDepartments")}</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue={0} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value={0}>{t("reports.tabDaily")}</TabsTrigger>
          <TabsTrigger value={1}>{t("reports.tabWeekly")}</TabsTrigger>
          <TabsTrigger value={2}>{t("reports.tabMonthly")}</TabsTrigger>
        </TabsList>

        <TabsContent value={0}>
          {loading ? (
            <LoadingState />
          ) : data?.type === "daily" ? (
            <DailyReport data={data} />
          ) : null}
        </TabsContent>

        <TabsContent value={1}>
          {loading ? (
            <LoadingState />
          ) : data?.type === "weekly" ? (
            <WeeklyReport data={data} />
          ) : null}
        </TabsContent>

        <TabsContent value={2}>
          {loading ? (
            <LoadingState />
          ) : data?.type === "monthly" ? (
            <MonthlyReport data={data} />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoadingState() {
  const t = useT();
  return (
    <div className="flex h-32 items-center justify-center text-muted-foreground">
      {t("reports.loadingReport")}
    </div>
  );
}

function DailyReport({ data }: { data: DailyData }) {
  const t = useT();
  return (
    <div className="space-y-4 pt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("reports.totalOnLeave")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.summary.totalOnLeave}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("reports.totalOT")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {Math.round(data.summary.totalOtMinutes / 60 * 10) / 10}h
            </p>
            <p className="text-xs text-muted-foreground">
              {t("reports.minutes").replace("{count}", String(data.summary.totalOtMinutes))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("reports.employeesOnLeave")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("reports.noneOnLeave")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.colEmployee")}</TableHead>
                  <TableHead className="text-right">{t("reports.colLeaveHours")}</TableHead>
                  <TableHead>{t("reports.colStatus")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>{emp.name}</TableCell>
                    <TableCell className="text-right">
                      {emp.totalHours}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t(`common.status.${emp.status}`)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data.otRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("reports.otRecords")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.colEmployee")}</TableHead>
                  <TableHead className="text-right">{t("reports.colOtMinutes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.otRecords.map((r, i) => (
                  <TableRow key={`${r.id}-${i}`}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">
                      {r.otMinutes}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WeeklyReport({ data }: { data: WeeklyData }) {
  const t = useT();
  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-muted-foreground">
        {t("reports.week")
          .replace("{start}", format(new Date(data.weekStart), "MMM d"))
          .replace("{end}", format(new Date(data.weekEnd), "MMM d, yyyy"))}
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("reports.totalLeave")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {data.summary.totalLeaveHours}h
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("reports.totalOT")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {Math.round(data.summary.totalOtMinutes / 60 * 10) / 10}h
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("reports.approvalRate")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {data.summary.approvalRate}%
            </p>
            <p className="text-xs text-muted-foreground">
              {t("reports.approvedRejected")
                .replace("{approved}", String(data.summary.approvedCount))
                .replace("{rejected}", String(data.summary.rejectedCount))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bar chart: leave hours by day of week */}
      <Card>
        <CardHeader>
          <CardTitle>{t("reports.leaveByDay")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dayOfWeekHours}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="hours"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("reports.employeeBreakdown")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("reports.noData")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("reports.colEmployee")}</TableHead>
                    <TableHead className="text-right">
                      {t("reports.colThisWeek")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("reports.colLastWeek")}
                    </TableHead>
                    <TableHead className="text-right">{t("reports.colDelta")}</TableHead>
                    <TableHead className="text-right">
                      {t("reports.colOtMin")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.employees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.name}</TableCell>
                      <TableCell className="text-right">
                        {e.thisWeekHours}
                      </TableCell>
                      <TableCell className="text-right">
                        {e.prevWeekHours}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            e.delta > 0
                              ? "text-red-500"
                              : e.delta < 0
                                ? "text-green-500"
                                : ""
                          }
                        >
                          {e.delta > 0 ? "+" : ""}
                          {e.delta}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {e.otMinutes}
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

function MonthlyReport({ data }: { data: MonthlyData }) {
  const t = useT();
  const chartData = data.departments.map((d) => ({
    name: d.departmentName,
    hours: d.totalLeaveHours,
  }));

  const deptsWithDeficit = data.departments.filter(
    (d) => d.flex.employeesWithRemaining > 0
  );

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-muted-foreground">
        {format(new Date(data.monthStart), "MMMM yyyy")}
      </p>

      {/* Department summary table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("reports.departmentSummary")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.departments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("reports.noData")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("reports.colDepartment")}</TableHead>
                    <TableHead className="text-right">{t("reports.colEmployees")}</TableHead>
                    <TableHead className="text-right">
                      {t("reports.colLeaveHours")}
                    </TableHead>
                    <TableHead className="text-right">{t("reports.colOtHours")}</TableHead>
                    <TableHead className="text-right">
                      {t("reports.colUtilization")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.departments.map((d) => (
                    <TableRow key={d.departmentId}>
                      <TableCell>{d.departmentName}</TableCell>
                      <TableCell className="text-right">
                        {d.employeeCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {d.totalLeaveHours}
                      </TableCell>
                      <TableCell className="text-right">
                        {Math.round(d.totalOtMinutes / 60 * 10) / 10}
                      </TableCell>
                      <TableCell className="text-right">
                        {d.utilizationRate}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bar chart: leave hours by department */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("reports.leaveByDept")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    dataKey="hours"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 5 leave takers */}
      {data.topLeaveTakers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("reports.topLeaveTakers")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.topLeaveTakers.map((emp, i) => (
                <li
                  key={emp.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    <span className="mr-2 font-medium text-muted-foreground">
                      #{i + 1}
                    </span>
                    {emp.name}
                  </span>
                  <span className="font-medium">{emp.hours}h</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Flex time section */}
      {deptsWithDeficit.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("reports.uncompensatedDeficit")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.colDepartment")}</TableHead>
                  <TableHead className="text-right">
                    {t("reports.colTotalDeficit")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("reports.colTotalMakeup")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("reports.colEmployeesRemaining")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deptsWithDeficit.map((d) => (
                  <TableRow key={d.departmentId}>
                    <TableCell>{d.departmentName}</TableCell>
                    <TableCell className="text-right">
                      {d.flex.totalDeficit}
                    </TableCell>
                    <TableCell className="text-right">
                      {d.flex.totalMakeup}
                    </TableCell>
                    <TableCell className="text-right">
                      {d.flex.employeesWithRemaining}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
