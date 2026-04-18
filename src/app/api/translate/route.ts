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
  texts: string[],
  target: string,
  source: string | undefined,
  apiKey: string
): Promise<string[]> {
  const body = new URLSearchParams();
  for (const t of texts) body.append("text", t);
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
  return texts.map((t, i) => data.translations[i]?.text ?? t);
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

    const body = (await request.json()) as {
      text?: string;
      texts?: string[];
      target: string;
      source?: string;
    };
    const { target, source } = body;
    const inputs: string[] = body.texts
      ? body.texts
      : body.text
        ? [body.text]
        : [];

    if (inputs.length === 0 || !target) {
      return Response.json(
        { error: "Missing text/texts or target" },
        { status: 400 }
      );
    }
    const totalLen = inputs.reduce((s, t) => s + t.length, 0);
    if (totalLen > 120_000) {
      return Response.json(
        { error: "Payload too large (max 120k chars)" },
        { status: 400 }
      );
    }
    if (inputs.length > 50) {
      return Response.json(
        { error: "Too many items (max 50 per request)" },
        { status: 400 }
      );
    }

    const apiKey = process.env.DEEPL_API_KEY;
    let translatedArr: string[];
    let provider: "deepl" | "mymemory";

    if (apiKey) {
      translatedArr = await translateWithDeepL(inputs, target, source, apiKey);
      provider = "deepl";
    } else {
      translatedArr = [];
      for (const t of inputs) {
        try {
          translatedArr.push(
            await translateWithMyMemory(t, target, source ?? "auto")
          );
        } catch {
          translatedArr.push(t);
        }
      }
      provider = "mymemory";
    }

    // Backward compat: when single `text` was sent, also return `translated`.
    return Response.json({
      translated: translatedArr[0],
      translatedArray: translatedArr,
      provider,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Translation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
