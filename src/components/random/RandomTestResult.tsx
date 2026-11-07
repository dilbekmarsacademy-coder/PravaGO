"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlarmClockOffIcon, ArrowLeftIcon, CheckIcon, ShuffleIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RANDOM_CHUNK, getRandomQuestions, type RandomQuestion, type RandomTestState } from "@/lib/api/random-tests";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { formatClock, formatDateTime } from "@/lib/test/timer";
import { Button, buttonClasses } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { KeywordChip } from "@/components/keywords/KeywordChip";
import { KeywordText } from "@/components/keywords/KeywordText";

type Filter = "all" | "wrong" | "unanswered";
const PAGE = 20;

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Natija: umumiy ko'rsatkichlar va savollar bo'yicha ro'yxat (bo'laklab yuklanadi). */
export function RandomTestResult({ state }: { state: RandomTestState }) {
  const { locale, t } = useLocale();
  const labels = t.kabinet.randomTest;
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [rows, setRows] = useState<Record<number, RandomQuestion>>({});
  const loading = useRef(new Set<number>());
  const [error, setError] = useState(false);

  // Xato — noto'g'ri javob yoki javobsiz (test tugagach javobsizlar xato hisoblanadi).
  const positions = useMemo(
    () =>
      state.items.flatMap((item, i) => {
        if (filter === "wrong") return item.correct === true ? [] : [i];
        if (filter === "unanswered") return item.answered ? [] : [i];
        return [i];
      }),
    [state.items, filter],
  );
  const visible = positions.slice(0, shown);

  useEffect(() => {
    const starts = [...new Set(visible.map((p) => Math.floor(p / RANDOM_CHUNK) * RANDOM_CHUNK))];
    for (const start of starts) {
      if (rows[start] || loading.current.has(start)) continue;
      loading.current.add(start);
      getRandomQuestions(state.id, start)
        .then((list) => setRows((prev) => ({ ...prev, ...Object.fromEntries(list.map((r) => [r.position, r])) })))
        .catch(() => setError(true))
        .finally(() => loading.current.delete(start));
    }
  }, [visible, rows, state.id]);

  const percent = state.percent;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
      {state.status === "expired" && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border border-danger/40 bg-danger/10 px-5 py-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
            <AlarmClockOffIcon className="size-5" />
          </span>
          <p className="text-sm font-medium text-foreground">{labels.timeUp}</p>
        </div>
      )}

      <Card className="flex flex-col items-center gap-5 px-6 py-8 text-center sm:flex-row sm:text-left" data-testid="random-result">
        <div className="relative size-36 shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r={RING_RADIUS} fill="none" strokeWidth="10" className="stroke-foreground/[0.07]" />
            <circle
              cx="60"
              cy="60"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - percent / 100)}
              className="stroke-brand transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-3xl font-bold text-foreground tabular-nums" data-testid="random-percent">
              {percent}%
            </span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {state.correct} / {state.total}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
          <p className="font-mono text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">{t.testSession.resultTitle}</p>
          <h1 className="font-display text-xl font-bold text-foreground">{labels.pageTitle(state.size)}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(state.startedAt)} · {labels.status[state.status]}
          </p>
        </div>
      </Card>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t.testSession.correctLabel} value={state.correct} tone="success" />
        <Stat label={t.testSession.wrongLabel} value={state.wrong} tone="danger" />
        <Stat label={t.testSession.unansweredLabel} value={state.unanswered} tone="muted" />
        <Stat label={t.testSession.timeSpent} value={formatClock(state.durationSec)} tone="muted" />
      </dl>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Link href="/kabinet/random" className={buttonClasses({ size: "lg", className: "flex-1" })}>
          <ShuffleIcon className="size-4" />
          {labels.newTest}
        </Link>
        <Link href="/kabinet" className={buttonClasses({ variant: "secondary", size: "lg", className: "flex-1" })}>
          <ArrowLeftIcon className="size-4" />
          {t.kabinet.backToKabinet}
        </Link>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold text-foreground">{labels.reviewTitle}</h2>
          <div className="flex gap-1 rounded-full border border-border bg-foreground/[0.03] p-1" role="tablist">
            {(
              [
                ["all", labels.filterAll, state.total],
                ["wrong", labels.filterWrong, state.wrong + state.unanswered],
                ["unanswered", labels.filterUnanswered, state.unanswered],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => {
                  setFilter(value);
                  setShown(PAGE);
                }}
                data-testid={`random-filter-${value}`}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  filter === value ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label} <span className="tabular-nums opacity-80">{count}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-danger">{labels.loadError}</p>}
        {positions.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">{labels.filterEmpty}</p>
        ) : (
          <ol className="mt-4 flex flex-col gap-3" data-testid="random-review-list">
            {visible.map((position) => {
              const row = rows[position];
              if (!row) return <li key={position} className="skeleton-shimmer h-28 rounded-2xl" />;
              const r = row.review;
              const selected = row.question.options.find((o) => o.id === r?.selectedOptionId);
              const correct = row.question.options.find((o) => o.id === r?.correctOptionId);
              const tone = !r?.selectedOptionId ? "muted" : r.correct ? "success" : "danger";
              return (
                <li key={position} className="rounded-2xl border border-border bg-foreground/[0.02] p-4" data-testid="random-review-item">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold",
                        tone === "success" && "bg-success/15 text-success",
                        tone === "danger" && "bg-danger/15 text-danger",
                        tone === "muted" && "bg-foreground/10 text-muted-foreground",
                      )}
                    >
                      {position + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug text-foreground">
                        <KeywordText text={row.question.text} highlight={r?.keywords?.question?.highlight} tone="question" />
                      </p>
                      {row.question.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.question.imageSmallUrl ?? row.question.imageUrl} alt="" loading="lazy" className="mt-3 max-h-48 w-auto rounded-xl object-contain" />
                      )}
                      <dl className="mt-3 flex flex-col gap-1.5 text-sm">
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-muted-foreground">{t.testSession.yourAnswer}:</dt>
                          <dd className={cn("font-medium", tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-muted-foreground italic")}>
                            {selected ? localize(selected.text, locale) : labels.notAnswered}
                            {tone === "success" && <CheckIcon className="ml-1 inline size-4" />}
                            {tone === "danger" && <XIcon className="ml-1 inline size-4" />}
                          </dd>
                        </div>
                        {!r?.correct && correct && (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-muted-foreground">{t.testSession.correctAnswer}:</dt>
                            <dd className="font-medium text-success">
                              <KeywordText text={correct.text} highlight={r?.keywords?.answer?.highlight} tone="answer" />
                            </dd>
                          </div>
                        )}
                      </dl>
                      {r && <KeywordChip keywords={r.keywords} className="mt-3" />}
                      {r?.explanation && <p className="mt-2 text-sm text-foreground/90">{localize(r.explanation, locale)}</p>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {positions.length > shown && (
          <Button variant="secondary" className="mt-4 w-full" onClick={() => setShown((s) => s + PAGE)} data-testid="random-show-more">
            {labels.showMore} ({positions.length - shown})
          </Button>
        )}
      </Card>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: "success" | "danger" | "muted" }) {
  return (
    <Card className="px-4 py-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 font-mono text-xl font-bold tabular-nums", tone === "success" && "text-success", tone === "danger" && "text-danger", tone === "muted" && "text-foreground")}>
        {value}
      </dd>
    </Card>
  );
}
