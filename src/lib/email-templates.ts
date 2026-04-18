import type { Locale } from "./email";
import { appUrl } from "./email";

export type EmailEvent =
  | "leave_submitted_to_approver"
  | "leave_approved"
  | "leave_rejected"
  | "leave_cancel_requested"
  | "leave_cancel_approved"
  | "leave_cancel_rejected";

interface LeaveEmailCtx {
  recipientName: string;
  employeeName: string; // owner of the leave request
  startDate: string; // YYYY-MM-DD
  endDate: string;
  totalHours: number;
  reason?: string | null;
  comment?: string | null;
  leaveId: string;
}

const TEXT: Record<
  Locale,
  Record<
    EmailEvent,
    {
      subject: (c: LeaveEmailCtx) => string;
      greeting: string;
      body: (c: LeaveEmailCtx) => string;
      cta: string;
      ctaPath: (c: LeaveEmailCtx) => string;
    }
  >
> = {
  vi: {
    leave_submitted_to_approver: {
      subject: (c) => `[Đơn phép] ${c.employeeName} - chờ duyệt`,
      greeting: "Chào bạn,",
      body: (c) =>
        `${c.employeeName} vừa gửi đơn nghỉ phép từ ${c.startDate} đến ${c.endDate} (${c.totalHours}h)${c.reason ? `\nLý do: ${c.reason}` : ""}.\nVui lòng xem xét và duyệt đơn.`,
      cta: "Xem đơn",
      ctaPath: () => `/approvals`,
    },
    leave_approved: {
      subject: () => `[Đơn phép] Đơn của bạn đã được duyệt`,
      greeting: "Chào bạn,",
      body: (c) =>
        `Đơn nghỉ phép từ ${c.startDate} đến ${c.endDate} (${c.totalHours}h) đã được duyệt.${c.comment ? `\nGhi chú: ${c.comment}` : ""}`,
      cta: "Xem chi tiết",
      ctaPath: (c) => `/leaves/${c.leaveId}`,
    },
    leave_rejected: {
      subject: () => `[Đơn phép] Đơn của bạn bị từ chối`,
      greeting: "Chào bạn,",
      body: (c) =>
        `Đơn nghỉ phép từ ${c.startDate} đến ${c.endDate} đã bị từ chối.${c.comment ? `\nLý do: ${c.comment}` : ""}`,
      cta: "Xem chi tiết",
      ctaPath: (c) => `/leaves/${c.leaveId}`,
    },
    leave_cancel_requested: {
      subject: (c) => `[Đơn phép] ${c.employeeName} yêu cầu hủy đơn`,
      greeting: "Chào bạn,",
      body: (c) =>
        `${c.employeeName} yêu cầu hủy đơn nghỉ phép đã duyệt (${c.startDate} → ${c.endDate}, ${c.totalHours}h).\nVui lòng duyệt yêu cầu hủy.`,
      cta: "Xem yêu cầu",
      ctaPath: () => `/approvals`,
    },
    leave_cancel_approved: {
      subject: () => `[Đơn phép] Yêu cầu hủy đã được chấp nhận`,
      greeting: "Chào bạn,",
      body: (c) =>
        `Yêu cầu hủy đơn nghỉ phép (${c.startDate} → ${c.endDate}) đã được chấp nhận. Số giờ phép đã được hoàn lại.`,
      cta: "Xem chi tiết",
      ctaPath: (c) => `/leaves/${c.leaveId}`,
    },
    leave_cancel_rejected: {
      subject: () => `[Đơn phép] Yêu cầu hủy bị từ chối`,
      greeting: "Chào bạn,",
      body: (c) =>
        `Yêu cầu hủy đơn nghỉ phép (${c.startDate} → ${c.endDate}) bị từ chối. Đơn vẫn giữ trạng thái đã duyệt.${c.comment ? `\nLý do: ${c.comment}` : ""}`,
      cta: "Xem chi tiết",
      ctaPath: (c) => `/leaves/${c.leaveId}`,
    },
  },
  en: {
    leave_submitted_to_approver: {
      subject: (c) => `[Leave] ${c.employeeName} - pending approval`,
      greeting: "Hi,",
      body: (c) =>
        `${c.employeeName} submitted a leave request from ${c.startDate} to ${c.endDate} (${c.totalHours}h)${c.reason ? `\nReason: ${c.reason}` : ""}.\nPlease review and approve.`,
      cta: "Review",
      ctaPath: () => `/approvals`,
    },
    leave_approved: {
      subject: () => `[Leave] Your request was approved`,
      greeting: "Hi,",
      body: (c) =>
        `Your leave request from ${c.startDate} to ${c.endDate} (${c.totalHours}h) has been approved.${c.comment ? `\nNote: ${c.comment}` : ""}`,
      cta: "View details",
      ctaPath: (c) => `/leaves/${c.leaveId}`,
    },
    leave_rejected: {
      subject: () => `[Leave] Your request was rejected`,
      greeting: "Hi,",
      body: (c) =>
        `Your leave request from ${c.startDate} to ${c.endDate} was rejected.${c.comment ? `\nReason: ${c.comment}` : ""}`,
      cta: "View details",
      ctaPath: (c) => `/leaves/${c.leaveId}`,
    },
    leave_cancel_requested: {
      subject: (c) => `[Leave] ${c.employeeName} requests cancellation`,
      greeting: "Hi,",
      body: (c) =>
        `${c.employeeName} is requesting to cancel an approved leave (${c.startDate} → ${c.endDate}, ${c.totalHours}h).\nPlease review.`,
      cta: "Review",
      ctaPath: () => `/approvals`,
    },
    leave_cancel_approved: {
      subject: () => `[Leave] Cancellation approved`,
      greeting: "Hi,",
      body: (c) =>
        `Your cancellation request (${c.startDate} → ${c.endDate}) has been approved. Leave hours have been restored.`,
      cta: "View details",
      ctaPath: (c) => `/leaves/${c.leaveId}`,
    },
    leave_cancel_rejected: {
      subject: () => `[Leave] Cancellation rejected`,
      greeting: "Hi,",
      body: (c) =>
        `Your cancellation request (${c.startDate} → ${c.endDate}) was rejected. The leave remains approved.${c.comment ? `\nReason: ${c.comment}` : ""}`,
      cta: "View details",
      ctaPath: (c) => `/leaves/${c.leaveId}`,
    },
  },
  ja: {
    leave_submitted_to_approver: {
      subject: (c) => `[休暇申請] ${c.employeeName} - 承認待ち`,
      greeting: "お疲れ様です。",
      body: (c) =>
        `${c.employeeName}さんが ${c.startDate} から ${c.endDate}（${c.totalHours}時間）の休暇申請を提出しました。${c.reason ? `\n理由: ${c.reason}` : ""}\nご確認と承認をお願いします。`,
      cta: "確認する",
      ctaPath: () => `/approvals`,
    },
    leave_approved: {
      subject: () => `[休暇申請] 申請が承認されました`,
      greeting: "お疲れ様です。",
      body: (c) =>
        `${c.startDate} から ${c.endDate}（${c.totalHours}時間）の休暇申請が承認されました。${c.comment ? `\n備考: ${c.comment}` : ""}`,
      cta: "詳細を見る",
      ctaPath: (c) => `/leaves/${c.leaveId}`,
    },
    leave_rejected: {
      subject: () => `[休暇申請] 申請が却下されました`,
      greeting: "お疲れ様です。",
      body: (c) =>
        `${c.startDate} から ${c.endDate} の休暇申請が却下されました。${c.comment ? `\n理由: ${c.comment}` : ""}`,
      cta: "詳細を見る",
      ctaPath: (c) => `/leaves/${c.leaveId}`,
    },
    leave_cancel_requested: {
      subject: (c) => `[休暇申請] ${c.employeeName} キャンセル依頼`,
      greeting: "お疲れ様です。",
      body: (c) =>
        `${c.employeeName}さんが承認済み休暇（${c.startDate} → ${c.endDate}、${c.totalHours}時間）のキャンセルを依頼しました。\nご確認をお願いします。`,
      cta: "確認する",
      ctaPath: () => `/approvals`,
    },
    leave_cancel_approved: {
      subject: () => `[休暇申請] キャンセルが承認されました`,
      greeting: "お疲れ様です。",
      body: (c) =>
        `キャンセル依頼（${c.startDate} → ${c.endDate}）が承認されました。休暇時間は戻されました。`,
      cta: "詳細を見る",
      ctaPath: (c) => `/leaves/${c.leaveId}`,
    },
    leave_cancel_rejected: {
      subject: () => `[休暇申請] キャンセルが却下されました`,
      greeting: "お疲れ様です。",
      body: (c) =>
        `キャンセル依頼（${c.startDate} → ${c.endDate}）が却下されました。休暇は承認済みのままです。${c.comment ? `\n理由: ${c.comment}` : ""}`,
      cta: "詳細を見る",
      ctaPath: (c) => `/leaves/${c.leaveId}`,
    },
  },
};

function wrapHtml(
  greeting: string,
  recipientName: string,
  bodyText: string,
  ctaLabel: string,
  ctaHref: string
): string {
  const paragraphs = bodyText
    .split("\n")
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px 0;color:#111;line-height:1.5">${escapeHtml(p)}</p>`)
    .join("");
  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f9;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;border:1px solid #e5e7eb">
    <p style="margin:0 0 12px 0;color:#111">${escapeHtml(greeting)} <strong>${escapeHtml(recipientName)}</strong></p>
    ${paragraphs}
    <p style="margin:24px 0 0 0">
      <a href="${ctaHref}" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:500">${escapeHtml(ctaLabel)}</a>
    </p>
    <p style="margin:24px 0 0 0;color:#6b7280;font-size:12px">Leave Tool · <a href="${appUrl("/settings")}" style="color:#6b7280">Cài đặt thông báo / Notification settings</a></p>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderLeaveEmail(
  event: EmailEvent,
  locale: Locale,
  ctx: LeaveEmailCtx
): { subject: string; html: string; text: string } {
  const tpl = TEXT[locale][event];
  const subject = tpl.subject(ctx);
  const bodyText = tpl.body(ctx);
  const href = appUrl(tpl.ctaPath(ctx));
  const html = wrapHtml(tpl.greeting, ctx.recipientName, bodyText, tpl.cta, href);
  const text = `${tpl.greeting} ${ctx.recipientName}\n\n${bodyText}\n\n${tpl.cta}: ${href}`;
  return { subject, html, text };
}

export type { LeaveEmailCtx };
