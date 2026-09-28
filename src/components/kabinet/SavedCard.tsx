"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, BookmarkIcon } from "lucide-react";
import { Card } from "@/components/shared/Card";
import { buttonClasses } from "@/components/shared/Button";
import { getSavedList, type SavedItem } from "@/lib/api/saved";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { SAVED_PAGE_HREF } from "@/lib/saved/actions";
import { formatAgo, topicBySlug } from "@/lib/saved/format";
import { useSavedState } from "@/lib/saved/store";

const PREVIEW_SIZE = 3;

/** Kabinetdagi "Saqlanganlar" kartasi: soni va oxirgi 3 ta saqlangan savol. */
export default function SavedCard() {
  const { locale, t } = useLocale();
  const { count, revision } = useSavedState();
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [now, setNow] = useState(0);
  const total = count?.total ?? items?.length ?? 0;

  // Saqlash/o'chirishdan keyin (revision) ro'yxat yangilanadi.
  useEffect(() => {
    let cancelled = false;
    getSavedList({ lang: locale, limit: PREVIEW_SIZE })
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setNow(Date.now());
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, revision]);

  return (
    <Card className="p-6 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-brand/10 text-brand">
            <BookmarkIcon className="size-4" />
          </span>
          <h2 className="font-display text-base font-bold text-foreground">{t.saved.card.eyebrow}</h2>
        </div>
        {total > 0 && (
          <span className="font-mono text-sm font-semibold text-muted-foreground tabular-nums">{t.saved.total(total)}</span>
        )}
      </div>

      {items === null ? (
        <div className="mt-4 flex flex-col gap-2" aria-hidden="true">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-14 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t.saved.card.empty}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">{t.saved.card.desc(total)}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {items.map((item) => {
              const topic = topicBySlug(item.topicSlug);
              const text = localize(item.question.text, locale);
              const location = topic
                ? t.saved.item.location(topic.number, item.question.order)
                : t.saved.item.questionNo(item.question.order);
              return (
                <li key={item.questionId}>
                  <Link
                    href={SAVED_PAGE_HREF}
                    className="flex items-center gap-3 rounded-xl border border-border bg-foreground/[0.02] px-3.5 py-3 outline-none transition-colors hover:border-brand/40 hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                        {location} · {formatAgo(item.createdAt, now, t.saved.ago)}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                        {text || (topic ? localize(topic.title, locale) : location)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Link href={SAVED_PAGE_HREF} className={buttonClasses({ variant: "secondary", size: "md", className: "mt-5" })}>
        {t.saved.card.viewAll}
        <ArrowRightIcon className="size-4" />
      </Link>
    </Card>
  );
}
