import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DEFAULT_LOCALE, LOCALE_COOKIE, Locale, isLocale } from "./index";

/**
 * Resolve locale on the server in priority order:
 * 1. cookie (latest user choice, works before DB load)
 * 2. employee.preferredLocale (persistent user pref)
 * 3. DEFAULT_LOCALE
 */
export async function resolveLocale(): Promise<Locale> {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (userId) {
      const emp = await prisma.employee.findUnique({
        where: { id: userId },
        select: { preferredLocale: true },
      });
      if (emp && isLocale(emp.preferredLocale)) return emp.preferredLocale;
    }
  } catch {
    // ignore, fall through to default
  }

  return DEFAULT_LOCALE;
}
