"use client";

import { LOCALE_META } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
}

export default function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className={cn(
        "glass flex shrink-0 items-center gap-0.5 rounded-full p-0.5",
        className,
      )}
      role="group"
      aria-label="Til"
    >
      {LOCALE_META.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => setLocale(item.value)}
          aria-pressed={locale === item.value}
          className={cn(
            "rounded-full px-2 py-1.5 font-mono text-[0.68rem] font-bold tracking-wide transition-colors",
            locale === item.value
              ? "bg-gradient-to-r from-neon-orange to-neon-orange-2 text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
