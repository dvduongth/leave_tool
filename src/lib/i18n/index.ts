import vi from "./locales/vi.json";
import en from "./locales/en.json";
import ja from "./locales/ja.json";

export type Locale = "vi" | "en" | "ja";

export const SUPPORTED_LOCALES: Locale[] = ["vi", "en", "ja"];
export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALE_COOKIE = "locale";

export type Messages = typeof vi;

export const messages: Record<Locale, Messages> = {
  vi,
  en,
  ja,
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "vi" || value === "en" || value === "ja";
}

/**
 * Resolve nested key like "nav.dashboard" → string.
 * Falls back to key itself if missing.
 */
export function translate(msgs: Messages, key: string): string {
  const parts = key.split(".");
  let cur: unknown = msgs;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return key;
    }
  }
  return typeof cur === "string" ? cur : key;
}
