"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlarmClockOffIcon, ArrowLeftIcon, AwardIcon, CheckIcon, FlagIcon, ScrollTextIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EXAM_TYPE_LABEL,
  formatPercent,
  getCertificate,
  getFinalExamOverview,
  getFinalQuestions,
  type AttemptState,
  type Certificate,
  type ExamQuestion,
  type FinalExamOverview,
} from "@/lib/api/final-exam";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { formatClock } from "@/lib/test/timer";
import { Button, buttonClasses } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { showToast } from "@/components/shared/Toast";
import { KeywordChip } from "@/components/keywords/KeywordChip";
import { StartExamDialog } from "./StartExamDialog";

const CelebrationOverlay = dynamic(() => import("@/components/certificate/CelebrationOverlay"), { ssr: false });

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Urinish natijasi: foiz, urinishlar va o'rtacha, o'tdi/o'tmadi, savollar tahlili. */
export function FinalExamResult({ state }: { state: AttemptState }) {
  const { locale } = useLocale();
  const router = useRouter();
  const [overview, setOverview] = useState<FinalExamOverview | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[] | null>(null);
  const [celebrate, setCelebrate] = useState<Certificate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [onlyWrong, setOnlyWrong] = useState(true);

  useEffect(() => {
    getFinalExamOverview()
      .then(setOverview)
      .catch(() => undefined);
    getFinalQuestions(state.id)
      .then(setQuestions)
      .catch(() => undefined);
  }, [state.id]);

  const type = overview?.types.find((t) => t.type === state.type);
  const certificateNumber = state.certificateNumber ?? type?.certificate?.certificateNumber ?? null;

  // O'tish sharti endi bajarildi — xat va sertifikat avtomatik (ko'rilmagan bo'lsa).
  useEffect(() => {
    if (!certificateNumber || !type?.certificate || type.certificate.celebrated) return;
    getCertificate(certificateNumber)
      .then(setCelebrate)
      .catch(() => undefined);
  }, [certificateNumber, type?.certificate]);

  async function openCelebration() {
    if (!certificateNumber) return;
    setCelebrate(await getCertificate(certificateNumber));
  }

  const percent = state.percent ?? 0;
  const outcome = type?.outcome ?? state.outcome;
  const average = type?.average ?? state.average;
  const visible = useMemo(() => (questions ?? []).filter((q) => !onlyWrong || !q.review?.correct), [questions, onlyWrong]);
  const wrong = (questions ?? []).filter((q) => !q.review?.correct).length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
      {state.status === "EXPIRED" && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border border-danger/40 bg-danger/10 px-5 py-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
            <AlarmClockOffIcon className="size-5" />
          </span>
          <p className="text-sm font-medium text-foreground">Vaqt tugadi — imtihon avtomatik yakunlandi. Javob berilmagan savollar xato hisoblandi.</p>
        </div>
      )}

      <Card className="flex flex-col items-center gap-5 px-6 py-8 text-center sm:flex-row sm:text-left" data-testid="exam-result">
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
              className={cn("transition-[stroke-dashoffset] duration-700 ease-out", percent >= 98 ? "stroke-success" : "stroke-brand")}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-3xl font-bold text-foreground tabular-nums" data-testid="exam-percent">
              {formatPercent(percent)}
            </span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {state.correct ?? 0} / {state.total}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
          <p className="font-mono text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            {state.archived ? "Arxiv (urinishlar nolga qaytarilgan)" : `${state.attemptNo}-urinish natijasi`}
          </p>
          <h1 className="font-display text-xl font-bold text-foreground">Yakuniy imtihon · {EXAM_TYPE_LABEL[state.type]}</h1>
          <p className="text-sm text-muted-foreground" data-testid="exam-result-attempts">
            {type ? `${type.attemptsUsed}/${type.maxAttempts} urinish` : `${state.finishedAttempts}/${state.maxAttempts} urinish`} · o&apos;rtacha:{" "}
            <b className="text-foreground">{average !== null ? formatPercent(average) : "—"}</b> · vaqt: {formatClock(Math.min(state.durationSec, state.limitSec))}
          </p>
        </div>
      </Card>

      {outcome === "passed" && (
        <Card className="relative overflow-hidden border-success/40 bg-gradient-to-br from-success/10 to-brand/5 p-6" data-testid="exam-passed">
          <div className="flex items-start gap-3">
            <span className="glow-orange flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-background">
              <AwardIcon className="size-5" />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-foreground">Tabriklaymiz! Siz ichki imtihondan o&apos;tdingiz</p>
              <p className="mt-1 text-sm text-muted-foreground">
                10 ta urinishning o&apos;rtachasi {average !== null ? formatPercent(average) : ""}. Sertifikatingiz kabinetdagi &quot;Sertifikatlar&quot; bo&apos;limida saqlandi.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button size="md" onClick={openCelebration} disabled={!certificateNumber} data-testid="exam-open-certificate">
                  <ScrollTextIcon className="size-4" />
                  Xat va sertifikatni ko&apos;rish
                </Button>
                <Link href="/kabinet/sertifikatlar" className={buttonClasses({ variant: "secondary", size: "md" })}>
                  Sertifikatlar
                </Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      {outcome === "failed" && (
        <Card className="border-warning/40 bg-warning/[0.06] p-6" data-testid="exam-failed">
          <p className="font-display text-lg font-bold text-foreground">
            O&apos;rtacha natija {average !== null ? formatPercent(average) : "—"}. O&apos;tish uchun kamida 98% kerak.
          </p>
          {type?.failureNote && <p className="mt-2 text-sm leading-relaxed text-foreground/85">{type.failureNote}</p>}
        </Card>
      )}

      {outcome === "in_progress" && !state.archived && (
        <Card className="p-5 text-sm text-muted-foreground">
          O&apos;tish uchun shu turdagi 10 ta urinishning o&apos;rtachasi kamida 98% bo&apos;lishi kerak.{" "}
          {type && type.attemptsLeft > 0 && (
            <>
              Yana <b className="text-foreground">{type.attemptsLeft} ta</b> urinish qoldi.
            </>
          )}
        </Card>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row">
        {overview && type && type.attemptsLeft > 0 && outcome === "in_progress" && (
          <Button size="lg" className="flex-1" onClick={() => setDialogOpen(true)} data-testid="exam-next-attempt">
            <FlagIcon className="size-4" />
            Keyingi urinish
          </Button>
        )}
        <Link href="/kabinet/imtihon" className={buttonClasses({ variant: "secondary", size: "lg", className: "flex-1" })}>
          <ArrowLeftIcon className="size-4" />
          Imtihon natijalari
        </Link>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold text-foreground">Savollar tahlili</h2>
          <div className="flex gap-1 rounded-full border border-border bg-foreground/[0.03] p-1" role="tablist">
            {(
              [
                [true, `Xatolar ${wrong}`],
                [false, `Hammasi ${questions?.length ?? state.total}`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                role="tab"
                aria-selected={onlyWrong === value}
                onClick={() => setOnlyWrong(value)}
                className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition-colors", onlyWrong === value ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {!questions ? (
          <div className="skeleton-shimmer mt-4 h-28 rounded-2xl" />
        ) : visible.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">Xato yo&apos;q — barcha javoblar to&apos;g&apos;ri.</p>
        ) : (
          <ol className="mt-4 flex flex-col gap-3">
            {visible.map((row) => {
              const r = row.review;
              const selected = row.question.options.find((o) => o.id === r?.selectedOptionId);
              const correct = row.question.options.find((o) => o.id === r?.correctOptionId);
              const tone = !r?.selectedOptionId ? "muted" : r.correct ? "success" : "danger";
              return (
                <li key={row.position} className="rounded-2xl border border-border bg-foreground/[0.02] p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold",
                        tone === "success" && "bg-success/15 text-success",
                        tone === "danger" && "bg-danger/15 text-danger",
                        tone === "muted" && "bg-foreground/10 text-muted-foreground",
                      )}
                    >
                      {row.position + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug text-foreground">{localize(row.question.text, locale)}</p>
                      {row.question.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.question.imageSmallUrl ?? row.question.imageUrl} alt="" loading="lazy" className="mt-3 max-h-48 w-auto rounded-xl object-contain" />
                      )}
                      <dl className="mt-3 flex flex-col gap-1.5 text-sm">
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-muted-foreground">Sizning javobingiz:</dt>
                          <dd className={cn("font-medium", tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-muted-foreground italic")}>
                            {selected ? localize(selected.text, locale) : "Javob berilmagan"}
                            {tone === "success" && <CheckIcon className="ml-1 inline size-4" />}
                            {tone === "danger" && <XIcon className="ml-1 inline size-4" />}
                          </dd>
                        </div>
                        {!r?.correct && correct && (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-muted-foreground">To&apos;g&apos;ri javob:</dt>
                            <dd className="font-medium text-success">{localize(correct.text, locale)}</dd>
                          </div>
                        )}
                      </dl>
                      {r && <KeywordChip keywords={r.keywords} className="mt-3" />}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {overview && <StartExamDialog open={dialogOpen} onOpenChange={setDialogOpen} overview={overview} />}

      {celebrate && (
        <CelebrationOverlay
          certificate={celebrate}
          onDone={() => {
            setCelebrate(null);
            showToast({ tone: "success", message: "Sertifikat kabinetingizdagi “Sertifikatlar” bo'limiga saqlandi", action: { label: "Ko'rish", href: "/kabinet/sertifikatlar" } });
            router.push("/kabinet/sertifikatlar");
          }}
        />
      )}
    </main>
  );
}
