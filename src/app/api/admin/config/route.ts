import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth-utils";
import {
  getAllConfigs,
  setConfig,
  CONFIG_DEFS,
  type ConfigKey,
} from "@/lib/config";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const configs = await getAllConfigs();
    return Response.json(configs);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    if (message === "Forbidden")
      return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await request.json();
    const { key, value } = body;
    if (!key || !(key in CONFIG_DEFS)) {
      return Response.json({ error: "Invalid config key" }, { status: 400 });
    }
    if (value == null) {
      return Response.json({ error: "Missing value" }, { status: 400 });
    }
    await setConfig(key as ConfigKey, String(value));
    return Response.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized")
      return Response.json({ error: message }, { status: 401 });
    if (message === "Forbidden")
      return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: message }, { status: 400 });
  }
}
