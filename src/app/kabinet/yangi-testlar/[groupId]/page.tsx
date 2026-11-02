"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CheckCircle2Icon, FolderOpenIcon } from "lucide-react";
import { listCollectionGroups, type CollectionGroup } from "@/lib/api/collections";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { AppHeader } from "@/components/shared/AppHeader";
import { buttonClasses } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";

/** "Yangi testlar" to'plami ichidagi testlar (nashr qilinganlari). */
export default function NewTestsGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { t, locale } = useLocale();
  const labels = t.kabinet.newTests;
  const [group, setGroup] = useState<CollectionGroup | null | undefined>(undefined);

  useEffect(() => {
    listCollectionGroups()
      .then((groups) => setGroup(groups.find((g) => g.id === groupId) ?? null))
      .catch(() => setGroup(null));
  }, [groupId]);

  return (
    <>
      <AppHeader>
        <Link href="/kabinet" aria-label={t.kabinet.backToKabinet} className={buttonClasses({ variant: "secondary", size: "icon", className: "size-11 md:size-10" })}>
          <ArrowLeftIcon className="size-4.5" />
        </Link>
        <span className="truncate text-sm font-semibold text-foreground">{labels.back}</span>
      </AppHeader>
      <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
        {group === undefined ? (
          <div className="h-40 animate-pulse rounded-2xl bg-foreground/[0.04]" />
        ) : (
          <Card className="p-6 sm:p-7">
            <h1 className="flex items-center gap-2.5 font-display text-xl font-bold break-words text-foreground" data-testid="group-name">
              <FolderOpenIcon className="size-5 shrink-0 text-brand" />
              {group?.name ?? labels.title}
            </h1>
            {!group || group.tests.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">{labels.groupEmpty}</p>
            ) : (
              <ul className="mt-5 flex flex-col gap-3">
                {group.tests.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/test/${c.slug}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-foreground/[0.02] px-4 py-3 transition-colors hover:border-brand/40 hover:bg-foreground/[0.05]"
                      data-testid="group-test"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold break-words text-foreground">{localize(c.title, locale)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {labels.questions(c.questionCount)} · {c.bestPercent === null ? labels.notStarted : labels.best(c.bestPercent)}
                        </span>
                      </span>
                      {c.passed && <CheckCircle2Icon className="size-5 shrink-0 text-success" />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </main>
    </>
  );
}
