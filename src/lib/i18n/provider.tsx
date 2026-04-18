"use client";

import { createContext, useCallback, useContext, useState } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  Locale,
  Messages,
  messages,
  translate,
} from "./index";

interface LocaleContextValue {
  locale: Locale;
  t: (key: string) => string;
  setLocale: (l: Locale) => void;
  messages: Messages;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    initialLocale ?? DEFAULT_LOCALE
  );

  const t = useCallback(
    (key: string) => translate(messages[locale], key),
    [locale]
  );

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    // persist cookie (1 year)
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 365}`;
    // also persist to user profile (fire & forget)
    fetch("/api/user/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: l }),
    }).catch(() => {});
  }, []);

  return (
    <LocaleContext.Provider
      value={{ locale, t, setLocale, messages: messages[locale] }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

/**
 * Convenience hook — returns only the t() function.
 */
export function useT() {
  return useLocale().t;
}
