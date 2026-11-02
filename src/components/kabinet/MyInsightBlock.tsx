"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrainCircuitIcon, LightbulbIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import { getInsight, refreshInsight, type InsightTopic, type StudentInsight } from "@/lib/api/insight";
import { useLocale } from "@/lib/i18n/useLocale";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";

const DATE_LOCALE = { "uz-latn": "uz-Latn-UZ", "uz-cyrl": "uz-Cyrl-UZ", ru: "ru-RU" } as const;

/** Kabinetdagi "Mening tahlilim": raqamlar bazadan, AI xulosa va 3 maslahat (kuniga ko'pi bilan bir marta). */
export default function MyInsightBlock() {
  const { t, locale } = useLocale();
  const labels = t.kabinet.insight;
  const [data, setData] = useState<StudentInsight | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    getInsight(locale)
      .then(setData)
      .catch(() => setError(true));
  }, [locale]);

  async function refresh() {
    setBusy(true);
    setError(false);
    try {
      setData(await refreshInsight(locale));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString(DATE_LOCALE[locale], { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  if (!data) {
    return error ? null : <Card className="h-28 animate-pulse p-6" data-testid="my-insight" />;
  }
  const s = data.stats;

  return (
    <Card className="p-6 sm:p-7" data-testid="my-insight">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-brand/15 text-brand">
          <BrainCircuitIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-foreground">{labels.title}</h2>
          <p className="text-xs text-muted-foreground">{labels.desc}</p>
        </div>
        {data.aiConfigured && data.canRefresh && (
          <Button size="sm" variant={data.insight ? "secondary" : "primary"} onClick={refresh} disabled={busy} data-testid="my-insight-refresh">
            {data.insight ? <RefreshCwIcon className={`size-4 ${busy ? "animate-spin" : ""}`} /> : <SparklesIcon className="size-4" />}
            {data.insight ? labels.refresh : labels.generate}
          </Button>
        )}
      </div>

      {s.attempts === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">{labels.noAttempts}</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label={labels.topicsPassed(s.topics.passed, s.topics.total)} value={`${s.topics.total ? Math.round((s.topics.passed / s.topics.total) * 100) : 0}%`} />
            <Tile label={labels.average} value={`${s.averagePercent}%`} />
            <Tile label={labels.recent} value={`${s.recentAveragePercent}%`} />
            <Tile label={labels.accuracy} value={s.answers.total ? `${s.answers.percent}%` : "—"} />
          </div>

          {data.insight ? (
            <div className="mt-4 rounded-xl border border-brand/25 bg-brand/[0.06] p-4" data-testid="my-insight-text">
              <p className="text-sm leading-relaxed text-foreground">{data.insight.summary}</p>
              {data.insight.tips.length > 0 && (
                <>
                  <h3 className="mt-3 flex items-center gap-1.5 text-xs font-bold text-brand uppercase">
                    <LightbulbIcon className="size-3.5" /> {labels.tips}
                  </h3>
                  <ol className="mt-1.5 flex list-decimal flex-col gap-1 pl-5 text-sm text-foreground">
                    {data.insight.tips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ol>
                </>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                {labels.updated(fmt(data.insight.createdAt))}
                {data.nextRefreshAt ? ` · ${labels.nextAt(fmt(data.nextRefreshAt))}` : !data.canRefresh ? ` · ${labels.upToDate}` : ""}
              </p>
            </div>
          ) : (
            !data.aiConfigured && <p className="mt-4 text-sm text-muted-foreground">{labels.aiOff}</p>
          )}
          {error && <p className="mt-3 text-sm text-danger">{labels.error}</p>}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TopicList title={labels.weak} topics={s.weakTopics} tone="warning" />
            <TopicList title={labels.strong} topics={s.strongTopics} tone="success" />
          </div>
          {s.mostWrongTopics.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">{s.mostWrongTopics.map((tp) => `${tp.title} — ${labels.mostWrong(tp.wrong ?? 0)}`).join(" · ")}</p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">{labels.privacy}</p>
        </>
      )}
    </Card>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-foreground/[0.02] px-3 py-2.5">
      <div className="font-display text-xl font-bold text-foreground">{value}</div>
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}

function TopicList({ title, topics, tone }: { title: string; topics: InsightTopic[]; tone: "warning" | "success" }) {
  if (!topics.length) return null;
  return (
    <div>
      <h3 className={`mb-1.5 text-xs font-bold uppercase ${tone === "warning" ? "text-warning" : "text-success"}`}>{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {topics.map((tp) => (
          <li key={tp.slug}>
            <Link href={`/kabinet/mavzu/${tp.slug}`} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-brand/40">
              <span className="min-w-0 break-words text-foreground">{tp.title}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{tp.bestPercent}%</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
