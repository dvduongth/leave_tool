import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { logAudit, getRequestIp } from "@/lib/audit";

// Simple in-memory rate limit (per IP). Reset window: 60s, max 5 attempts.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

function checkRate(ip: string): boolean {
  const now = Date.now();
  const r = attempts.get(ip);
  if (!r || r.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  r.count++;
  return r.count <= MAX_ATTEMPTS;
}

function validatePassword(pw: string): string | null {
  if (typeof pw !== "string" || pw.length < 8) {
    return "Mật khẩu mới phải có ít nhất 8 ký tự";
  }
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return "Mật khẩu mới phải có cả chữ và số";
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const ip = getRequestIp(request) ?? "unknown";
    if (!checkRate(ip)) {
      return Response.json(
        { error: "Quá nhiều lần thử, vui lòng thử lại sau 1 phút" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body ?? {};

    if (!currentPassword || !newPassword) {
      return Response.json(
        { error: "currentPassword and newPassword are required" },
        { status: 400 }
      );
    }
    const pwError = validatePassword(newPassword);
    if (pwError) return Response.json({ error: pwError }, { status: 400 });
    if (currentPassword === newPassword) {
      return Response.json(
        { error: "Mật khẩu mới phải khác mật khẩu cũ" },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { id: true, password: true },
    });
    if (!employee) return Response.json({ error: "Not found" }, { status: 404 });

    const ok = await bcrypt.compare(currentPassword, employee.password);
    if (!ok) {
      return Response.json({ error: "Mật khẩu hiện tại không đúng" }, { status: 400 });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.employee.update({
      where: { id: user.id },
      data: { password: hash, mustChangePassword: false },
    });

    await logAudit({
      userId: user.id,
      action: "PASSWORD_CHANGE",
      entity: "employee",
      entityId: user.id,
      ipAddress: ip,
    });

    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "Unauthorized") return Response.json({ error: message }, { status: 401 });
    return Response.json({ error: message }, { status: 500 });
  }
}
