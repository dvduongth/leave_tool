import { Resend } from "resend";

type Locale = "vi" | "en" | "ja";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let resendClient: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

/**
 * Fire-and-forget email send. Never throws — logs errors instead.
 * Controlled by EMAIL_ENABLED env flag.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (process.env.EMAIL_ENABLED !== "true") return;

  const from = process.env.EMAIL_FROM || "Leave Tool <noreply@sgsa.jp>";
  const client = getClient();
  if (!client) {
    console.warn("[email] RESEND_API_KEY missing, skipping send");
    return;
  }

  try {
    const { error } = await client.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) {
      console.error("[email] send failed:", error);
    }
  } catch (err) {
    console.error("[email] send exception:", err);
  }
}

export function appUrl(path = ""): string {
  const base = process.env.APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

export type { Locale };
