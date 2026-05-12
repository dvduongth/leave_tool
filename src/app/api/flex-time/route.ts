import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { createNotification } from "@/lib/notifications";
import { Role } from "@/generated/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = request.nextUrl;
    const month = searchParams.get("month"); // YYYY-MM
    const employeeId = searchParams.get("employeeId");
    const type = searchParams.get("type"); // DEFICIT | MAKEUP

    // Build date filter
    const dateFilter: { gte?: Date; lt?: Date } = {};
    if (month) {
      const [year, m] = month.split("-").map(Number);
      dateFilter.gte = new Date(year, m - 1, 1);
      dateFilter.lt = new Date(year, m, 1);
    }

    // Build employee filter based on role
    let employeeFilter: { employeeId?: string; employee?: object } = {};

    if (user.role === Role.ADMIN) {
      if (employeeId) employeeFilter.employeeId = employeeId;
    } else if (user.role === Role.HEAD) {
      if (employeeId) {
        employeeFilter.employeeId = employeeId;
        employeeFilter.employee = { departmentId: user.departmentId };
      } else {
        employeeFilter.employee = { departmentId: user.departmentId };
      }
    } else if (user.role === Role.MANAGER) {
      if (employeeId) {
        employeeFilter.employeeId = employeeId;
      } else {
        employeeFilter = {
          employeeId: undefined,
          employee: {
            OR: [{ id: user.id }, { managerId: user.id }],
          },
        };
        delete employeeFilter.employeeId;
      }
    } else {
      employeeFilter.employeeId = user.id;
    }

    const records = await prisma.flexTimeRecord.findMany({
      where: {
        ...employeeFilter,
        ...(type ? { type: type as "DEFICIT" | "MAKEUP" } : {}),
        ...(dateFilter.gte ? { date: dateFilter } : {}),
      },
      include: {
        employee: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    // Include monthly summary if month is specified
    let summary = null;
    if (month) {
      const targetEmployeeId = employeeId || user.id;
      summary = await prisma.flexTimeMonthlySummary.findUnique({
        where: {
          employeeId_yearMonth: {
            employeeId: targetEmployeeId,
            yearMonth: month,
          },
        },
      });
    }

    return Response.json({ records, summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    if (message === "Forbidden")
      return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { type, date, minutes, reason } = body;

    // Validate date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return Response.json({ error: "Invalid date" }, { status: 400 });
    }

    // Validate type
    if (type !== "DEFICIT" && type !== "MAKEUP") {
      return Response.json(
        { error: "Type must be DEFICIT or MAKEUP" },
        { status: 400 }
      );
    }

    const reasonTrimmed = typeof reason === "string" ? reason.trim() : "";
    if (!reasonTrimmed) {
      return Response.json({ error: "Vui lòng nhập lý do" }, { status: 400 });
    }

    // If MAKEUP: validate there's at least one DEFICIT in the same month
    if (type === "MAKEUP") {
      const yearMonth = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}`;
      const monthStart = new Date(
        parsedDate.getFullYear(),
        parsedDate.getMonth(),
        1
      );
      const monthEnd = new Date(
        parsedDate.getFullYear(),
        parsedDate.getMonth() + 1,
        1
      );

      const deficitCount = await prisma.flexTimeRecord.count({
        where: {
          employeeId: user.id,
          type: "DEFICIT",
          date: { gte: monthStart, lt: monthEnd },
        },
      });

      if (deficitCount === 0) {
        return Response.json(
          {
            error:
              "Cannot create MAKEUP record without at least one DEFICIT in the same month",
          },
          { status: 400 }
        );
      }
    }

    const record = await prisma.flexTimeRecord.create({
      data: {
        employeeId: user.id,
        type,
        date: parsedDate,
        minutes,
        reason: reasonTrimmed,
        status: "PENDING",
      },
    });

    // Notify the approver(s): direct manager first, fall back to dept HEAD.
    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { name: true, managerId: true, departmentId: true },
    });
    const dept = employee?.departmentId
      ? await prisma.department.findUnique({
          where: { id: employee.departmentId },
          select: { headId: true },
        })
      : null;
    const recipients = new Set<string>();
    if (employee?.managerId) recipients.add(employee.managerId);
    else if (dept?.headId && dept.headId !== user.id) recipients.add(dept.headId);
    const dateStr = parsedDate.toISOString().slice(0, 10);
    const kindLabel = type === "DEFICIT" ? "ghi nhận thiếu giờ" : "ghi nhận bù giờ";
    for (const r of recipients) {
      await createNotification(
        r,
        "Yêu cầu Flex Time mới",
        `${employee?.name ?? "Nhân viên"} ${kindLabel} ngày ${dateStr} (${minutes} phút)`,
        `/flex-time`,
        "flex-time",
        record.id
      );
    }

    return Response.json(record, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
