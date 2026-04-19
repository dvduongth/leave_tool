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

  // Test-mode override: redirect all mail to a single inbox.
  // Useful when sending domain is not verified yet (Resend sandbox).
  const override = process.env.EMAIL_TEST_OVERRIDE_TO;
  const actualTo = override || input.to;
  const actualSubject = override
    ? `[to:${input.to}] ${input.subject}`
    : input.subject;

  try {
    const { error } = await client.emails.send({
      from,
      to: actualTo,
      subject: actualSubject,
      html: input.html,
      text: input.text,
    });
    if (error) {
      console.error("[email] send failed:", error);
    } else if (override) {
      console.log(
        `[email] sent (override: ${input.to} -> ${actualTo}): ${input.subject}`
      );
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
