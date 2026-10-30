"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LockIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { Badge } from "@/components/shared/Badge";
import { ErrorBlock, LoadingBlock, PageHeader, Panel } from "@/components/admin/ui";

interface DayInfo {
  day: number;
  editable: boolean;
  topics: { slug: string; order: number; title: string; titleCyrl: string | null; questionCount: number; needsReviewCount: number; noKeywordsCount: number; noCorrectCount: number; hasVideo: boolean }[];
}

export default function AdminContentPage() {
  const [days, setDays] = useState<DayInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<DayInfo[]>("content/days").then(setDays).catch((err: Error) => setError(err.message));
  }, []);

  return (
    <>
      <PageHeader title="Kontent" subtitle="Kunlar → mavzular. Mavzuni ochib, videoni, savollarni, rasmlarni, javoblarni va kalit so'zlarni o'zgartiring." />
      {error && <ErrorBlock message={error} />}
      {!days ? (
        <LoadingBlock />
      ) : (
        <div className="flex flex-col gap-4">
          {days.map((d) => (
            <Panel
              key={d.day}
              title={`${d.day}-kun`}
              actions={d.editable ? <Badge tone="success">tahrirlash ochiq</Badge> : <Badge tone="muted"><LockIcon className="size-3" /> yopiq</Badge>}
              className={d.editable ? undefined : "opacity-60"}
            >
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {d.topics.map((t) => {
                  const body = (
                    <>
                      <p className="text-sm font-semibold text-foreground">
                        <span className="font-mono text-xs text-muted-foreground">{t.order}.</span> {t.title !== t.slug ? t.title : t.titleCyrl ?? t.slug}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {t.hasVideo && <Badge tone="brand">video</Badge>}
                        <Badge>{t.questionCount} savol</Badge>
                        {t.needsReviewCount > 0 && <Badge tone="warning">{t.needsReviewCount} tekshirilmagan</Badge>}
                        {t.noKeywordsCount > 0 && <Badge tone="muted">{t.noKeywordsCount} kalit so&apos;zsiz</Badge>}
                        {t.noCorrectCount > 0 && <Badge tone="danger">{t.noCorrectCount} javobsiz</Badge>}
                      </div>
                    </>
                  );
                  return (
                    <li key={t.slug}>
                      {d.editable ? (
                        <Link href={`/admin/content/${t.slug}`} className="block rounded-xl border border-border p-3 transition-colors hover:border-brand/60 hover:bg-surface">
                          {body}
                        </Link>
                      ) : (
                        <div className="rounded-xl border border-border p-3">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
