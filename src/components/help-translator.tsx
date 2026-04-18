"use client";

import { useEffect, useRef, useState } from "react";
import { Languages, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useT } from "@/lib/i18n/provider";

/**
 * Wraps static help content and auto-translates all text nodes when the
 * active locale differs from the source (Vietnamese).
 *
 * Handling dynamic DOM (e.g. Tabs that mount content lazily):
 * - A MutationObserver watches the container for added nodes.
 * - When a new subtree appears (e.g. user switches tab), we walk its text
 *   nodes, apply any already-cached translations instantly, then fire a
 *   single batched API request for any uncached strings.
 *
 * Caching:
 * - Per-locale `Record<sourceText, translatedText>` stored in localStorage
 *   under `help-<locale>-v2`. Survives page reloads. "Retranslate" clears it.
 */

const CACHE_VERSION = "v2";
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

function collectTextNodes(root: Node): TranslatableNode[] {
  // Only element nodes can host a TreeWalker; for text nodes, handle directly.
  if (root.nodeType === Node.TEXT_NODE) {
    const t = root.nodeValue ?? "";
    return isTranslatable(t)
      ? [{ node: root as Text, text: t.trim() }]
      : [];
  }
  if (!(root instanceof Element) && !(root instanceof Document)) return [];
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

type Status = "idle" | "translating" | "translated" | "error" | "original";

export function HelpTranslator({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const originalMapRef = useRef<Map<Text, string>>(new Map());
  const cacheRef = useRef<Record<string, string>>({});
  const inFlightRef = useRef<Set<string>>(new Set());
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNodesRef = useRef<TranslatableNode[]>([]);
  const showingOriginalRef = useRef(false);
  const [status, setStatus] = useState<Status>("idle");

  const cacheKey = () => `help-${locale}-${CACHE_VERSION}`;

  const loadCache = (): Record<string, string> => {
    try {
      const raw = localStorage.getItem(cacheKey());
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  };

  const saveCache = () => {
    try {
      localStorage.setItem(cacheKey(), JSON.stringify(cacheRef.current));
    } catch {
      /* storage full — skip */
    }
  };

  const applyNode = (n: TranslatableNode, translation: string) => {
    if (showingOriginalRef.current) return;
    if (!originalMapRef.current.has(n.node)) {
      originalMapRef.current.set(n.node, n.node.nodeValue ?? "");
    }
    const orig = n.node.nodeValue ?? "";
    const leading = orig.match(/^\s*/)?.[0] ?? "";
    const trailing = orig.match(/\s*$/)?.[0] ?? "";
    // Only overwrite if the node still contains the original source.
    if (orig.trim() === n.text) {
      n.node.nodeValue = leading + translation + trailing;
    }
  };

  const restoreOriginal = () => {
    showingOriginalRef.current = true;
    originalMapRef.current.forEach((orig, node) => {
      node.nodeValue = orig;
    });
    setStatus("original");
  };

  const flushPending = async () => {
    pendingTimerRef.current = null;
    const nodes = pendingNodesRef.current;
    pendingNodesRef.current = [];
    if (locale === SOURCE_LOCALE || nodes.length === 0) return;

    // 1. Apply cached translations immediately
    const uncachedTexts = new Set<string>();
    for (const n of nodes) {
      const cached = cacheRef.current[n.text];
      if (cached) {
        applyNode(n, cached);
      } else if (!inFlightRef.current.has(n.text)) {
        uncachedTexts.add(n.text);
      }
    }

    if (uncachedTexts.size === 0) {
      if (status !== "translated" && !showingOriginalRef.current) {
        setStatus("translated");
      }
      return;
    }

    // 2. Fetch uncached
    const toFetch = Array.from(uncachedTexts);
    toFetch.forEach((t) => inFlightRef.current.add(t));
    setStatus("translating");

    try {
      for (const batch of chunk(toFetch, BATCH_SIZE)) {
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
          const tr = data.translatedArray[i] ?? src;
          cacheRef.current[src] = tr;
        });
      }
      saveCache();

      // 3. Apply to every node we've seen so far that matches
      const root = containerRef.current;
      if (root) {
        for (const n of collectTextNodes(root)) {
          const tr = cacheRef.current[n.text];
          if (tr) applyNode(n, tr);
        }
      }
      setStatus(showingOriginalRef.current ? "original" : "translated");
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "Translation failed");
    } finally {
      toFetch.forEach((t) => inFlightRef.current.delete(t));
    }
  };

  const scheduleFlush = () => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(flushPending, 80);
  };

  const queueNodes = (nodes: TranslatableNode[]) => {
    if (nodes.length === 0) return;
    pendingNodesRef.current.push(...nodes);
    scheduleFlush();
  };

  // Full (re)translate — called on locale change, mount, and retranslate.
  const translateAll = () => {
    const root = containerRef.current;
    if (!root) return;
    showingOriginalRef.current = false;
    if (locale === SOURCE_LOCALE) {
      setStatus("idle");
      return;
    }
    cacheRef.current = loadCache();
    queueNodes(collectTextNodes(root));
  };

  // Mount + locale changes
  useEffect(() => {
    // Restore any nodes back to source before switching
    originalMapRef.current.forEach((orig, node) => {
      node.nodeValue = orig;
    });
    originalMapRef.current.clear();
    cacheRef.current = {};
    inFlightRef.current.clear();
    pendingNodesRef.current = [];
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    translateAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // Observe new DOM nodes (tab switches, dynamic content)
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const observer = new MutationObserver((mutations) => {
      if (locale === SOURCE_LOCALE || showingOriginalRef.current) return;
      const newNodes: TranslatableNode[] = [];
      for (const m of mutations) {
        m.addedNodes.forEach((added) => {
          newNodes.push(...collectTextNodes(added));
        });
      }
      if (newNodes.length > 0) queueNodes(newNodes);
    });

    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [locale]);

  const retranslate = () => {
    try {
      localStorage.removeItem(cacheKey());
    } catch {
      /* ignore */
    }
    originalMapRef.current.forEach((orig, node) => {
      node.nodeValue = orig;
    });
    originalMapRef.current.clear();
    cacheRef.current = {};
    inFlightRef.current.clear();
    showingOriginalRef.current = false;
    translateAll();
  };

  const reapply = () => {
    showingOriginalRef.current = false;
    const root = containerRef.current;
    if (!root) return;
    for (const n of collectTextNodes(root)) {
      const tr = cacheRef.current[n.text];
      if (tr) applyNode(n, tr);
    }
    setStatus("translated");
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
                onClick={reapply}
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
