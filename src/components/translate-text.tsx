"use client";

import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/i18n/provider";

interface TranslateTextProps {
  text: string;
  /** className applied to the wrapping text span */
  className?: string;
  /** Optional source language hint (vi/en/ja). Leave empty for auto-detect. */
  source?: "vi" | "en" | "ja";
}

/**
 * Inline text renderer with a "Translate" toggle button.
 * Shows the original by default; clicking the button calls /api/translate
 * and shows the translated version. Click again to show original.
 */
export function TranslateText({ text, className, source }: TranslateTextProps) {
  const { locale, t } = useLocale();
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);

  async function doTranslate() {
    if (showTranslated) {
      setShowTranslated(false);
      return;
    }
    if (translated) {
      setShowTranslated(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          target: locale,
          source,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("translate.failed"));
        return;
      }
      setTranslated(data.translated);
      setShowTranslated(true);
    } catch {
      toast.error(t("translate.failed"));
    } finally {
      setLoading(false);
    }
  }

  if (!text?.trim()) return null;

  return (
    <div className="space-y-1">
      <span className={className}>
        {showTranslated && translated ? translated : text}
      </span>
      <div>
        <button
          type="button"
          onClick={doTranslate}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Languages className="size-3" />
          )}
          {loading
            ? t("translate.loading")
            : showTranslated
              ? t("translate.showOriginal")
              : t("translate.button")}
        </button>
      </div>
    </div>
  );
}
