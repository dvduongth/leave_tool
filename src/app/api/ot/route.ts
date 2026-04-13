import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { calculateOTMinutes } from "@/lib/ot-calculator";
import { Role } from "@/generated/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = request.nextUrl;
    const month = searchParams.get("month"); // YYYY-MM
    const employeeId = searchParams.get("employeeId");

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
      // EMPLOYEE: own records only
      employeeFilter.employeeId = user.id;
    }

    const records = await prisma.oTRecord.findMany({
      where: {
        ...employeeFilter,
        ...(dateFilter.gte ? { date: dateFilter } : {}),
      },
      include: {
        employee: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    return Response.json(records);
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
    const { date, otStart, otEnd, note } = body;

    // Validate date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return Response.json({ error: "Invalid date" }, { status: 400 });
    }

    const otMinutes = calculateOTMinutes(otStart, otEnd);

    const record = await prisma.oTRecord.create({
      data: {
        employeeId: user.id,
        date: parsedDate,
        otStart,
        otEnd,
        otMinutes,
        note: note || null,
        status: "PENDING",
      },
    });

    return Response.json(record, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
