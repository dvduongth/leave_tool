import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const headerSecret = request.headers.get("authorization")?.replace("Bearer ", "");
  const querySecret = request.nextUrl.searchParams.get("secret");

  return headerSecret === secret || querySecret === secret;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
  const ms = Date.now() - start;

  return Response.json({
    ok: true,
    rows,
    elapsedMs: ms,
    at: new Date().toISOString(),
  });
}
