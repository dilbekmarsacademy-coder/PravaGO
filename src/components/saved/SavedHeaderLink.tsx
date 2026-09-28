"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BookmarkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/shared/Button";
import { useLocale } from "@/lib/i18n/useLocale";
import { SAVED_PAGE_HREF } from "@/lib/saved/actions";
import { formatBadgeCount } from "@/lib/saved/format";
import { loadSavedCount, useSavedState } from "@/lib/saved/store";

/** Kabinet header'idagi "Saqlanganlar" ikonkasi — soni badge bilan. Telefonda ham ko'rinadi. */
export function SavedHeaderLink({ className }: { className?: string }) {
  const { t } = useLocale();
  const { count } = useSavedState();
  const total = count?.total ?? 0;

  useEffect(() => {
    loadSavedCount({ force: true });
  }, []);

  return (
    <Link
      href={SAVED_PAGE_HREF}
      aria-label={t.saved.headerAria(total)}
      title={t.saved.title}
      className={buttonClasses({ variant: "secondary", size: "icon", className: cn("relative md:size-10", className) })}
    >
      <BookmarkIcon className="size-4.5" aria-hidden="true" />
      {total > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 font-mono text-[0.65rem] leading-none font-bold text-brand-foreground tabular-nums ring-2 ring-background"
        >
          {formatBadgeCount(total)}
        </span>
      )}
    </Link>
  );
}
