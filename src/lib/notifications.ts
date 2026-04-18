import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import {
  renderLeaveEmail,
  type EmailEvent,
  type LeaveEmailCtx,
} from "@/lib/email-templates";
import type { Locale } from "@/lib/email";

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      link,
    },
  });
}

/**
 * Create in-app notification AND send email (if user has emails enabled
 * and EMAIL_ENABLED flag is on). Fire-and-forget: email errors are logged,
 * not thrown. In-app notification is still created on email failure.
 */
export async function notifyLeaveEvent(
  userId: string,
  event: EmailEvent,
  ctx: Omit<LeaveEmailCtx, "recipientName">,
  inApp: { title: string; message: string; link?: string }
): Promise<void> {
  await createNotification(userId, inApp.title, inApp.message, inApp.link);

  try {
    const user = await prisma.employee.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        preferredLocale: true,
        emailNotifEnabled: true,
      },
    });
    if (!user || !user.emailNotifEnabled || !user.email) return;

    const locale = (user.preferredLocale || "vi") as Locale;
    const safeLocale: Locale =
      locale === "en" || locale === "ja" ? locale : "vi";
    const rendered = renderLeaveEmail(event, safeLocale, {
      ...ctx,
      recipientName: user.name,
    });

    // Fire-and-forget — don't await here so API response isn't delayed.
    void sendEmail({
      to: user.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  } catch (err) {
    console.error("[notifyLeaveEvent] email dispatch failed:", err);
  }
}

/**
 * Shortcut: build LeaveEmailCtx from a leave-like row and call notifyLeaveEvent.
 */
export async function notifyLeaveEventFromRequest(
  userId: string,
  event: EmailEvent,
  leave: {
    id: string;
    startDate: Date;
    endDate: Date;
    totalHours: number;
    reason?: string | null;
    employee: { name: string };
  },
  inApp: { title: string; message: string; link?: string },
  comment?: string | null
): Promise<void> {
  await notifyLeaveEvent(
    userId,
    event,
    {
      employeeName: leave.employee.name,
      startDate: leave.startDate.toISOString().slice(0, 10),
      endDate: leave.endDate.toISOString().slice(0, 10),
      totalHours: leave.totalHours,
      reason: leave.reason ?? null,
      comment: comment ?? null,
      leaveId: leave.id,
    },
    inApp
  );
}
