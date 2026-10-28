"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2Icon, SparklesIcon } from "lucide-react";
import { listCollections, type CollectionSummary } from "@/lib/api/collections";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { Card } from "@/components/shared/Card";

/** Kabinetdagi "Yangi testlar" — nashr qilingan to'plam bo'lmasa blok ko'rinmaydi. */
export default function NewTestsBlock() {
  const { t, locale } = useLocale();
  const labels = t.kabinet.newTests;
  const [items, setItems] = useState<CollectionSummary[]>([]);

  useEffect(() => {
    listCollections()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <Card className="p-6 sm:p-7" data-testid="new-tests-block">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-brand/15 text-brand">
          <SparklesIcon className="size-4" />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-foreground">{labels.title}</h2>
          <p className="text-xs text-muted-foreground">{labels.desc}</p>
        </div>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/test/${c.slug}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-foreground/[0.02] px-4 py-3 transition-colors hover:border-brand/40 hover:bg-foreground/[0.05]"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-foreground">{localize(c.title, locale)}</span>
                <span className="block text-xs text-muted-foreground">
                  {labels.questions(c.questionCount)} · {c.bestPercent === null ? labels.notStarted : labels.best(c.bestPercent)}
                </span>
              </span>
              {c.passed && <CheckCircle2Icon className="size-5 shrink-0 text-success" />}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
