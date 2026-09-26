"use client";

import { ChevronDownIcon, LanguagesIcon } from "lucide-react";
import { LOCALE_META } from "@/lib/i18n";
import { isLocale, useLocale } from "@/lib/i18n/useLocale";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <label className="relative flex h-10 shrink-0 items-center rounded-full border border-border text-muted-foreground transition-colors focus-within:border-brand/60 hover:border-brand/40 hover:text-foreground">
      <LanguagesIcon className="pointer-events-none absolute left-2.5 size-4" aria-hidden="true" />
      <span className="sr-only">{t.kabinet.header.language}</span>
      <select
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
        className="h-full cursor-pointer appearance-none rounded-full bg-transparent py-0 pr-7 pl-8 text-xs font-semibold text-foreground outline-none sm:pr-8"
      >
        {LOCALE_META.map((item) => (
          <option key={item.value} value={item.value} className="bg-background text-foreground">
            {item.nativeName}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 size-3.5" aria-hidden="true" />
    </label>
  );
}
