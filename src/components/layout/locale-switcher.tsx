"use client";

import { Globe, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/lib/i18n/provider";
import { Locale, SUPPORTED_LOCALES } from "@/lib/i18n";

const FLAG: Record<Locale, string> = {
  vi: "🇻🇳",
  en: "🇬🇧",
  ja: "🇯🇵",
};

const NAME: Record<Locale, string> = {
  vi: "Tiếng Việt",
  en: "English",
  ja: "日本語",
};

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg text-sm hover:bg-muted">
        <span className="text-base leading-none">{FLAG[locale]}</span>
        <span className="sr-only">{t("locale.label")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Globe className="size-3.5" />
          {t("locale.label")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LOCALES.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => {
              if (l !== locale) setLocale(l);
            }}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <span>{FLAG[l]}</span>
              <span>{NAME[l]}</span>
            </span>
            {l === locale && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
