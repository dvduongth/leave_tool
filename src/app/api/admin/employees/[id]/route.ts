import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, getCurrentUser } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";
import { totalAnnualLeaveHours } from "@/lib/seniority";
import { parseDateInput } from "@/lib/date-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        leaveBalances: { orderBy: { cycleYear: "desc" } },
      },
    });

    if (!employee) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    return Response.json(employee);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    if (message === "Forbidden")
      return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      email,
      password,
      role,
      workShift,
      departmentId,
      managerId,
      joinDate,
    } = body;

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    // Check email uniqueness if changed
    if (email && email !== existing.email) {
      const emailTaken = await prisma.employee.findUnique({ where: { email } });
      if (emailTaken) {
        return Response.json(
          { error: "An employee with this email already exists" },
          { status: 409 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (workShift !== undefined) data.workShift = workShift;
    if (departmentId !== undefined) data.departmentId = departmentId;
    if (managerId !== undefined) data.managerId = managerId || null;
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    let joinDateChanged = false;
    if (joinDate !== undefined) {
      const parsed = joinDate === null || joinDate === "" ? null : parseDateInput(joinDate);
      data.joinDate = parsed;
      joinDateChanged = true;
    }

    const updated = await prisma.employee.update({
      where: { id },
      data,
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        leaveBalances: { orderBy: { cycleYear: "desc" } },
      },
    });

    // Recompute totalHours on active (non-ended) cycles when joinDate changes.
    if (joinDateChanged) {
      const today = new Date();
      const activeBalances = await prisma.leaveBalance.findMany({
        where: {
          employeeId: id,
          cycleEnd: { gte: today },
        },
      });
      for (const b of activeBalances) {
        const newTotal = totalAnnualLeaveHours(updated.joinDate, b.cycleStart);
        if (newTotal !== b.totalHours) {
          await prisma.leaveBalance.update({
            where: { id: b.id },
            data: { totalHours: newTotal },
          });
        }
      }
    }

    return Response.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    if (message === "Forbidden")
      return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const currentUser = await getCurrentUser();
    const { id } = await params;

    if (currentUser?.id === id) {
      return Response.json(
        { error: "Bạn không thể tự xoá tài khoản của mình." },
        { status: 400 }
      );
    }

    const existing = await prisma.employee.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            leaveRequests: true,
            otRecords: true,
            flexTimeRecords: true,
            subordinates: true,
          },
        },
      },
    });
    if (!existing) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    // Block delete if this user heads a department
    const leadsDepartment = await prisma.department.findFirst({
      where: { headId: id },
      select: { name: true },
    });
    if (leadsDepartment) {
      return Response.json(
        {
          error: `Nhân viên này đang là trưởng phòng "${leadsDepartment.name}". Hãy chuyển Head sang người khác trước khi xoá.`,
        },
        { status: 409 }
      );
    }

    // Block delete if still has direct reports
    if (existing._count.subordinates > 0) {
      return Response.json(
        {
          error: `Nhân viên này đang quản lý ${existing._count.subordinates} người. Hãy đổi manager cho cấp dưới trước khi xoá.`,
        },
        { status: 409 }
      );
    }

    // Block delete if has historical records (leaves/OT/flex)
    const hasHistory =
      existing._count.leaveRequests > 0 ||
      existing._count.otRecords > 0 ||
      existing._count.flexTimeRecords > 0;

    if (hasHistory) {
      return Response.json(
        {
          error:
            "Nhân viên này đã có dữ liệu nghỉ phép / OT / flex time. Không thể xoá để giữ lịch sử. Nếu cần, hãy vô hiệu hoá thay vì xoá.",
        },
        { status: 409 }
      );
    }

    // Safe to hard-delete: remove leave balances + notifications first
    await prisma.leaveBalance.deleteMany({ where: { employeeId: id } });
    await prisma.notification.deleteMany({ where: { userId: id } });
    await prisma.employee.delete({ where: { id } });

    return Response.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    if (message === "Forbidden")
      return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: message }, { status: 500 });
  }
}
