"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, FolderOpenIcon, SparklesIcon } from "lucide-react";
import { listCollectionGroups, type CollectionGroup } from "@/lib/api/collections";
import { useLocale } from "@/lib/i18n/useLocale";
import { Card } from "@/components/shared/Card";

/** Kabinetdagi "Yangi testlar" — avval to'plamlar (nomi va testlar soni), to'plam ichida testlar. */
export default function NewTestsBlock() {
  const { t } = useLocale();
  const labels = t.kabinet.newTests;
  const [groups, setGroups] = useState<CollectionGroup[] | null>(null);

  useEffect(() => {
    listCollectionGroups()
      .then(setGroups)
      .catch(() => setGroups([]));
  }, []);

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
      {groups === null ? (
        <div className="mt-4 h-16 animate-pulse rounded-xl bg-foreground/[0.04]" />
      ) : groups.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/kabinet/yangi-testlar/${g.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-foreground/[0.02] px-4 py-3 transition-colors hover:border-brand/40 hover:bg-foreground/[0.05]"
                data-testid="new-tests-group"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <FolderOpenIcon className="size-5 shrink-0 text-brand" />
                  <span className="min-w-0">
                    <span className="block font-semibold break-words text-foreground">{g.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {labels.tests(g.testCount)}
                      {g.passedCount > 0 && ` · ${labels.passedOf(g.passedCount, g.testCount)}`}
                    </span>
                  </span>
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
