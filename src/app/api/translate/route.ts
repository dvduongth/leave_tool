import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";

/**
 * POST /api/translate
 * Body: { text: string, target: "VI" | "EN" | "JA", source?: "VI" | "EN" | "JA" }
 *
 * Uses DeepL API Free (env DEEPL_API_KEY). Falls back to MyMemory
 * (no key required) if DEEPL_API_KEY is missing.
 */

const DEEPL_TARGET_MAP: Record<string, string> = {
  vi: "VI",
  en: "EN-US",
  ja: "JA",
  VI: "VI",
  EN: "EN-US",
  JA: "JA",
};

const MYMEMORY_LANG: Record<string, string> = {
  vi: "vi-VN",
  en: "en-US",
  ja: "ja-JP",
};

async function translateWithDeepL(
  text: string,
  target: string,
  source: string | undefined,
  apiKey: string
): Promise<string> {
  const body = new URLSearchParams();
  body.append("text", text);
  body.append("target_lang", DEEPL_TARGET_MAP[target] ?? target);
  if (source) body.append("source_lang", DEEPL_TARGET_MAP[source] ?? source);

  // Free-tier endpoint is api-free.deepl.com
  const url = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`DeepL error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    translations: { text: string; detected_source_language?: string }[];
  };
  return data.translations[0]?.text ?? text;
}

async function translateWithMyMemory(
  text: string,
  target: string,
  source: string
): Promise<string> {
  const langpair = `${MYMEMORY_LANG[source] ?? source}|${MYMEMORY_LANG[target] ?? target}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    text
  )}&langpair=${encodeURIComponent(langpair)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory error ${res.status}`);
  const data = (await res.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number;
  };
  if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
    throw new Error("MyMemory translation failed");
  }
  return data.responseData.translatedText;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text, target, source } = (await request.json()) as {
      text: string;
      target: string;
      source?: string;
    };
    if (!text || !target) {
      return Response.json(
        { error: "Missing text or target" },
        { status: 400 }
      );
    }
    if (text.length > 5000) {
      return Response.json({ error: "Text too long (max 5000 chars)" }, {
        status: 400,
      });
    }

    const apiKey = process.env.DEEPL_API_KEY;
    let translated: string;
    let provider: "deepl" | "mymemory";

    if (apiKey) {
      translated = await translateWithDeepL(text, target, source, apiKey);
      provider = "deepl";
    } else {
      translated = await translateWithMyMemory(
        text,
        target,
        source ?? "auto"
      );
      provider = "mymemory";
    }

    return Response.json({ translated, provider });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Translation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
