"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ChevronRightIcon, PlayIcon, RotateCcwIcon, ShuffleIcon, TimerIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RANDOM_TEST_ACTIVE,
  RANDOM_TEST_NOT_ENOUGH,
  RANDOM_TEST_NO_QUESTIONS,
  RANDOM_TEST_SIZES,
  finishRandomTest,
  getRandomOverview,
  startRandomTest,
  type RandomOverview,
  type RandomTestSummary,
} from "@/lib/api/random-tests";
import { ApiError } from "@/lib/api/session";
import { useLocale } from "@/lib/i18n/useLocale";
import { formatClock, formatDateTime } from "@/lib/test/timer";
import { AppHeader } from "@/components/shared/AppHeader";
import { Badge } from "@/components/shared/Badge";
import { Button, buttonClasses } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Modal } from "@/components/shared/Modal";

interface RandomPageProps {
  searchParams: Promise<{ size?: string }>;
}

type Dialog = { kind: "confirm"; size: number } | { kind: "notEnough"; size: number; available: number } | null;

/** Tasodifiy test: tur tanlash (20/50/100/200), tugallanmagan test va oldingi natijalar. */
export default function RandomTestHubPage({ searchParams }: RandomPageProps) {
  const { size: sizeParam } = use(searchParams);
  const router = useRouter();
  const { t } = useLocale();
  const labels = t.kabinet.randomTest;
  const [data, setData] = useState<RandomOverview | null>(null);
  const [error, setError] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(false);
    getRandomOverview()
      .then(setData)
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Kabinetdagi kartadan kelinganda (?size=50) — tasdiqlash oynasi darhol (bir marta).
  const [autoOpened, setAutoOpened] = useState(false);
  useEffect(() => {
    const n = Number(sizeParam);
    if (!data || autoOpened || data.active || !(RANDOM_TEST_SIZES as readonly number[]).includes(n)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoOpened(true);
    setDialog({ kind: "confirm", size: n });
  }, [data, sizeParam, autoOpened]);

  async function start(size: number, allowFewer = false) {
    setBusy(true);
    setNotice(null);
    try {
      const state = await startRandomTest(size, allowFewer);
      router.push(`/test/random/${state.id}`);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.code === RANDOM_TEST_NOT_ENOUGH) {
        setDialog({ kind: "notEnough", size, available: Number(err.details?.available ?? 0) });
        return;
      }
      setDialog(null);
      if (err instanceof ApiError && err.code === RANDOM_TEST_ACTIVE) load();
      else if (err instanceof ApiError && err.code === RANDOM_TEST_NO_QUESTIONS) setNotice(labels.noQuestions);
      else setNotice(labels.loadError);
    }
  }

  async function finishActive(id: string) {
    setBusy(true);
    try {
      await finishRandomTest(id);
      router.push(`/test/random/${id}`);
    } catch {
      setBusy(false);
      setNotice(labels.loadError);
    }
  }

  const active = data?.active ?? null;

  return (
    <>
      <AppHeader>
        <Link href="/kabinet" aria-label={t.kabinet.backToKabinet} className={buttonClasses({ variant: "secondary", size: "icon", className: "size-11 md:size-10" })}>
          <ArrowLeftIcon className="size-4.5" />
        </Link>
        <span className="truncate text-sm font-semibold text-foreground">{t.kabinet.backToKabinet}</span>
      </AppHeader>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-8 sm:px-8">
        <Card className="p-6 sm:p-7">
          <h1 className="flex items-center gap-2.5 font-display text-xl font-bold text-foreground">
            <span className="flex size-9 items-center justify-center rounded-full bg-brand/10 text-brand">
              <ShuffleIcon className="size-4" />
            </span>
            {labels.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{labels.intro}</p>

          {active && (
            <div className="mt-5 rounded-2xl border border-brand/40 bg-brand/10 p-4" data-testid="random-active">
              <p className="font-display font-bold text-foreground">
                {labels.activeTitle} · {labels.sessionTitle(active.total)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {labels.activeDesc(active.answered, active.total)} <TimerIcon className="mb-0.5 inline size-3.5" /> {formatClock(Math.floor(active.remainingMs / 1000))}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/test/random/${active.id}`} className={buttonClasses({ size: "md" })} data-testid="random-continue">
                  <PlayIcon className="size-4" />
                  {labels.continue}
                </Link>
                <Button variant="secondary" disabled={busy} onClick={() => finishActive(active.id)} data-testid="random-finish-active">
                  {labels.finishActive}
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{labels.activeBlocks}</p>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RANDOM_TEST_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                disabled={!data || Boolean(active) || busy}
                onClick={() => setDialog({ kind: "confirm", size })}
                data-testid={`random-size-${size}`}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-foreground/[0.02] px-3 py-4 transition-colors hover:border-brand/50 hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="font-mono text-2xl font-bold text-foreground tabular-nums">{size}</span>
                <span className="text-xs text-muted-foreground uppercase">{labels.questionsUnit}</span>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-foreground/80">
                  <TimerIcon className="size-3" />
                  {labels.minutes(size)}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{labels.note}</p>
          {notice && (
            <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {notice}
            </p>
          )}
        </Card>

        <Card className="p-6 sm:p-7">
          <h2 className="font-display text-base font-bold text-foreground">{labels.historyTitle}</h2>
          {error ? (
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <span className="text-danger">{labels.loadError}</span>
              <Button variant="secondary" size="sm" onClick={load}>
                <RotateCcwIcon className="size-4" />
                {labels.retry}
              </Button>
            </div>
          ) : !data ? (
            <div className="mt-4 h-24 animate-pulse rounded-xl bg-foreground/[0.04]" />
          ) : data.history.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">{labels.historyEmpty}</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2" data-testid="random-history">
              {data.history.map((h) => (
                <li key={h.id}>
                  <HistoryRow item={h} date={formatDateTime(h.startedAt)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>

      <Modal
        open={dialog !== null}
        onOpenChange={(open) => !open && !busy && setDialog(null)}
        title={dialog?.kind === "notEnough" ? labels.notEnoughTitle : dialog ? labels.confirmTitle(dialog.size) : ""}
        description={dialog?.kind === "notEnough" ? labels.notEnoughDesc(dialog.available, dialog.size) : dialog ? labels.confirmDesc(dialog.size) : undefined}
      >
        {dialog && (
          <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>
              {labels.cancel}
            </Button>
            <Button
              autoFocus
              disabled={busy || (dialog.kind === "notEnough" && dialog.available === 0)}
              onClick={() => (dialog.kind === "notEnough" ? start(dialog.size, true) : start(dialog.size))}
              data-testid="random-start"
            >
              <PlayIcon className="size-4" />
              {busy ? labels.starting : dialog.kind === "notEnough" ? labels.startWithAvailable(dialog.available) : labels.start}
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}

function HistoryRow({ item, date }: { item: RandomTestSummary; date: string }) {
  const { t } = useLocale();
  const labels = t.kabinet.randomTest;
  return (
    <Link
      href={`/test/random/${item.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-foreground/[0.02] px-4 py-3 transition-colors hover:border-brand/40 hover:bg-foreground/[0.05]"
      data-testid="random-history-row"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-foreground/5 font-mono text-sm font-bold text-foreground tabular-nums">{item.size}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{date}</span>
        <span className="block text-xs text-muted-foreground">
          {item.correct} / {item.total} · {formatClock(item.durationSec)}
        </span>
      </span>
      <Badge tone={item.status === "expired" ? "danger" : "success"} className="hidden sm:inline-flex">
        {labels.status[item.status]}
      </Badge>
      <span className={cn("font-mono text-lg font-bold tabular-nums", item.percent >= 90 ? "text-success" : "text-foreground")}>{item.percent}%</span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
