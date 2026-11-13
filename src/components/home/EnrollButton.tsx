"use client";

// "Kursga yozilish" — landing'ning har bir bo'limida bir xil uslubdagi tugma.
// Telegram'dagi akademiya akkauntiga yangi oynada olib boradi. Havola qattiq
// yozilmaydi: BUSINESS.telegram (src/config/business.ts). Bosilganda mavjud
// analitikaga "enroll_click" hodisasi (path — bo'lim nomi) yuboriladi.

import { SendIcon } from "lucide-react";
import { BUSINESS } from "@/config/business";
import { track } from "@/lib/analytics";
import { useLocale } from "@/lib/i18n/useLocale";
import { cn } from "@/lib/utils";

interface EnrollButtonProps {
  /** Bo'lim nomi (analitika va testlar uchun), masalan "hero", "pricing-standard". */
  section: string;
  /** Mobilda butun kenglikda (kartalar ichida). */
  block?: boolean;
  className?: string;
}

export default function EnrollButton({ section, block = false, className }: EnrollButtonProps) {
  const { t } = useLocale();
  return (
    <a
      href={BUSINESS.telegram}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.enroll.aria}
      data-testid="enroll-telegram"
      data-section={section}
      onClick={() => track("enroll_click", { path: section })}
      className={cn(
        "glass inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-neon-cyan/40 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors outline-none hover:border-neon-cyan hover:text-neon-cyan focus-visible:ring-2 focus-visible:ring-neon-cyan",
        block && "w-full",
        className,
      )}
    >
      <SendIcon className="size-4 shrink-0 text-neon-cyan" aria-hidden="true" />
      {t.enroll.label}
    </a>
  );
}
