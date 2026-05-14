"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon, DownloadIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

type PeriodType = "day" | "week" | "month" | "year";

interface SummaryEmployee {
  id: string;
  name: string;
  leaveHours: number;
  otMinutes: number;
  menstrualDays: number;
  menstrualMinutes: number;
}

interface SummaryData {
  type: "summary";
  period: PeriodType;
  periodStart: string;
  periodEnd: string;
  employees: SummaryEmployee[];
  totals: {
    leaveHours: number;
    otMinutes: number;
    menstrualDays: number;
  };
}

interface Department {
  id: string;
  name: string;
}

const PERIOD_LABELS: Record<PeriodType, string> = {
  day: "Ngày",
  week: "Tuần",
  month: "Tháng",
  year: "Năm",
};

function formatPeriodRange(start: string, end: string, period: PeriodType): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  switch (period) {
    case "day":
      return format(startDate, "EEEE, d MMMM yyyy", { locale: vi });
    case "week":
      return `${format(startDate, "d/M")} - ${format(endDate, "d/M/yyyy")}`;
    case "month":
      return format(startDate, "MMMM yyyy", { locale: vi });
    case "year":
      return format(startDate, "yyyy");
  }
}

export default function ReportsPage() {
  const t = useT();
  const [period, setPeriod] = useState<PeriodType>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [departmentId, setDepartmentId] = useState<string>("ALL");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Fetch departments for filter
  useEffect(() => {
    fetch(`/api/reports?type=monthly&date=${format(new Date(), 'yyyy-MM-dd')}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.departments) {
          setDepartments(
            d.departments.map((dept: { departmentId: string; departmentName: string }) => ({
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
        type: "summary",
        period,
        date: format(selectedDate, 'yyyy-MM-dd'),
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
  }, [period, selectedDate, departmentId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const navigatePeriod = (direction: -1 | 1) => {
    const newDate = new Date(selectedDate);
    switch (period) {
      case "day":
        newDate.setDate(newDate.getDate() + direction);
        break;
      case "week":
        newDate.setDate(newDate.getDate() + direction * 7);
        break;
      case "month":
        newDate.setMonth(newDate.getMonth() + direction);
        break;
      case "year":
        newDate.setFullYear(newDate.getFullYear() + direction);
        break;
    }
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleExport = async () => {
    const params = new URLSearchParams({
      type: "summary",
      period,
      date: format(selectedDate, 'yyyy-MM-dd'),
    });
    if (departmentId !== "ALL") {
      params.set("departmentId", departmentId);
    }
    window.location.href = `/api/reports/export?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("reports.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("reports.subtitle")}
        </p>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(["day", "week", "month", "year"] as PeriodType[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>

        {/* Period navigation */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigatePeriod(-1)}>
            <ChevronLeft className="size-4" />
          </Button>

          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger className="inline-flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm hover:bg-muted min-w-[140px]">
              <CalendarIcon className="size-4" />
              {data ? formatPeriodRange(data.periodStart, data.periodEnd, period) : format(selectedDate, "d/M/yyyy")}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setDatePickerOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigatePeriod(1)}>
            <ChevronRight className="size-4" />
          </Button>

          <Button variant="ghost" size="sm" onClick={goToToday}>
            Hôm nay
          </Button>
        </div>

        {departments.length > 1 && (
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

        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={handleExport}
          disabled={loading || !data}
        >
          <DownloadIcon className="size-4 mr-2" />
          {t("reports.exportCsv")}
        </Button>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tổng nghỉ phép
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{data.totals.leaveHours}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tổng OT
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {Math.round(data.totals.otMinutes / 60 * 10) / 10}h
              </p>
              <p className="text-xs text-muted-foreground">
                ({data.totals.otMinutes} phút)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ngày nghỉ kinh nguyệt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{data.totals.menstrualDays}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Employee breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle>Chi tiết theo nhân viên</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : !data || data.employees.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              Không có dữ liệu trong khoảng thời gian này
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nhân viên</TableHead>
                    <TableHead className="text-right">Nghỉ phép (h)</TableHead>
                    <TableHead className="text-right">OT (phút)</TableHead>
                    <TableHead className="text-right">Nghỉ KN (ngày)</TableHead>
                    <TableHead className="text-right">Nghỉ KN (phút)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell className="text-right">{emp.leaveHours}</TableCell>
                      <TableCell className="text-right">{emp.otMinutes}</TableCell>
                      <TableCell className="text-right">{emp.menstrualDays}</TableCell>
                      <TableCell className="text-right">{emp.menstrualMinutes}</TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Tổng cộng</TableCell>
                    <TableCell className="text-right">{data.totals.leaveHours}</TableCell>
                    <TableCell className="text-right">{data.totals.otMinutes}</TableCell>
                    <TableCell className="text-right">{data.totals.menstrualDays}</TableCell>
                    <TableCell className="text-right">
                      {data.employees.reduce((s, e) => s + e.menstrualMinutes, 0)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
