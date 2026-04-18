"use client";

import { useEffect, useRef, useState } from "react";
import { Languages, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useT } from "@/lib/i18n/provider";

/**
 * Wraps static help content and auto-translates all text nodes when the
 * active locale differs from the source (Vietnamese).
 *
 * Strategy:
 * - On mount / locale change, walk children text nodes, collect translatable
 *   strings, POST in batches to /api/translate, swap textContent in place.
 * - Results cached in sessionStorage keyed by `help-<locale>-v1` so
 *   revisiting the page costs zero API calls.
 * - Original text stashed on each node (_orig) so we can restore instantly.
 */

const CACHE_VERSION = "v1";
const BATCH_SIZE = 40; // DeepL free tier accepts up to 50 per call
const SOURCE_LOCALE = "vi";

interface TranslatableNode {
  node: Text;
  text: string;
}

function isTranslatable(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  // Skip pure numbers, punctuation, or symbols
  if (/^[\d\s.,:;/\-–—()[\]{}!?"'`&*+=<>→←↑↓]+$/.test(trimmed)) return false;
  return true;
}

function collectTextNodes(root: HTMLElement): TranslatableNode[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const t = node.nodeValue ?? "";
      return isTranslatable(t)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const out: TranslatableNode[] = [];
  let n: Node | null = walker.nextNode();
  while (n) {
    out.push({ node: n as Text, text: (n.nodeValue ?? "").trim() });
    n = walker.nextNode();
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

export function HelpTranslator({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const originalMapRef = useRef<Map<Text, string>>(new Map());
  const [status, setStatus] = useState<
    "idle" | "translating" | "translated" | "error" | "original"
  >("idle");

  const applyTranslations = (
    nodes: TranslatableNode[],
    translations: string[]
  ) => {
    nodes.forEach((n, i) => {
      const t = translations[i];
      if (!t) return;
      // Stash original (preserving surrounding whitespace)
      if (!originalMapRef.current.has(n.node)) {
        originalMapRef.current.set(n.node, n.node.nodeValue ?? "");
      }
      const orig = n.node.nodeValue ?? "";
      const leading = orig.match(/^\s*/)?.[0] ?? "";
      const trailing = orig.match(/\s*$/)?.[0] ?? "";
      n.node.nodeValue = leading + t + trailing;
    });
  };

  const restoreOriginal = () => {
    originalMapRef.current.forEach((orig, node) => {
      node.nodeValue = orig;
    });
    setStatus("original");
  };

  const translate = async (force = false) => {
    const root = containerRef.current;
    if (!root) return;
    if (locale === SOURCE_LOCALE) {
      restoreOriginal();
      setStatus("idle");
      return;
    }

    const cacheKey = `help-${locale}-${CACHE_VERSION}`;
    const nodes = collectTextNodes(root);
    if (nodes.length === 0) return;

    // Try cache
    if (!force) {
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw) as Record<string, string>;
          const translations = nodes.map((n) => cached[n.text] ?? n.text);
          applyTranslations(nodes, translations);
          setStatus("translated");
          return;
        }
      } catch {
        /* ignore cache errors */
      }
    }

    setStatus("translating");
    try {
      // Deduplicate
      const uniqueTexts = Array.from(new Set(nodes.map((n) => n.text)));
      const map: Record<string, string> = {};

      for (const batch of chunk(uniqueTexts, BATCH_SIZE)) {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texts: batch,
            target: locale,
            source: SOURCE_LOCALE,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { translatedArray: string[] };
        batch.forEach((src, i) => {
          map[src] = data.translatedArray[i] ?? src;
        });
      }

      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(map));
      } catch {
        /* storage full — skip */
      }

      applyTranslations(
        nodes,
        nodes.map((n) => map[n.text] ?? n.text)
      );
      setStatus("translated");
    } catch (err) {
      setStatus("error");
      toast.error(
        err instanceof Error ? err.message : "Translation failed"
      );
    }
  };

  // Run on mount & whenever locale changes
  useEffect(() => {
    restoreOriginal();
    originalMapRef.current.clear();
    if (locale !== SOURCE_LOCALE) {
      translate(false);
    } else {
      setStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const retranslate = () => {
    const cacheKey = `help-${locale}-${CACHE_VERSION}`;
    try {
      sessionStorage.removeItem(cacheKey);
    } catch {
      /* ignore */
    }
    restoreOriginal();
    originalMapRef.current.clear();
    translate(true);
  };

  return (
    <div>
      {locale !== SOURCE_LOCALE && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            {status === "translating" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>{t("help.translator.translating")}</span>
              </>
            ) : status === "error" ? (
              <>
                <Languages className="size-3.5 text-destructive" />
                <span className="text-destructive">
                  {t("help.translator.error")}
                </span>
              </>
            ) : status === "original" ? (
              <>
                <Languages className="size-3.5" />
                <span>{t("help.translator.originalLabel")}</span>
              </>
            ) : (
              <>
                <Languages className="size-3.5" />
                <span>{t("help.translator.translated")}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {status === "translated" && (
              <button
                type="button"
                onClick={restoreOriginal}
                className="text-primary hover:underline"
              >
                {t("help.translator.showOriginal")}
              </button>
            )}
            {status === "original" && (
              <button
                type="button"
                onClick={() => translate(false)}
                className="text-primary hover:underline"
              >
                {t("help.translator.reapply")}
              </button>
            )}
            <button
              type="button"
              onClick={retranslate}
              disabled={status === "translating"}
              className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-50"
              title={t("help.translator.retranslate")}
            >
              <RotateCcw className="size-3" /> {t("help.translator.retranslate")}
            </button>
          </div>
        </div>
      )}
      <div ref={containerRef}>{children}</div>
    </div>
  );
}
