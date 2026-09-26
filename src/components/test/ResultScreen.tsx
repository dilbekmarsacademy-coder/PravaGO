"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { AlarmClockOffIcon, CheckIcon, RotateCcwIcon, TargetIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/shared/Badge";
import { Button, buttonClasses } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { EXAM_PASS_CORRECT, PASS_PERCENT, TIME_UP_REDIRECT_SEC } from "@/config/rules";
import type { ApiQuestion, CheckAnswerResult } from "@/lib/api/test";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { formatClock } from "@/lib/test/timer";
import type { TestMode } from "./QuestionView";

export interface ResultAnswer {
  selectedOptionId: string | null;
  result: CheckAnswerResult | null;
}

interface ResultScreenProps {
  reason: "manual" | "timeout";
  mode: TestMode;
  questions: ApiQuestion[];
  answers: Record<number, ResultAnswer>;
  elapsedSec: number;
  onRestart: () => void;
  onRetryWrong: (questionIds: string[]) => void;
}

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ResultScreen({ reason, mode, questions, answers, elapsedSec, onRestart, onRetryWrong }: ResultScreenProps) {
  const { locale, t } = useLocale();
  const total = questions.length;
  const correct = questions.filter((_, i) => answers[i]?.result?.correct).length;
  const answeredCount = questions.filter((_, i) => answers[i]?.result).length;
  const unanswered = total - answeredCount;
  const wrong = answeredCount - correct;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = mode === "exam" ? correct >= EXAM_PASS_CORRECT : percent >= PASS_PERCENT;

  // Xato va javobsiz savollar — "Xatolarni qayta ishlash" shu ro'yxat bilan boshlanadi.
  const mistakes = useMemo(
    () =>
      questions
        .map((question, index) => ({ question, index, answer: answers[index] }))
        .filter(({ answer }) => !answer?.result?.correct),
    [questions, answers],
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {passed && <Confetti />}
      {reason === "timeout" && <TimeUpBanner />}

      <Card className="flex flex-col items-center gap-5 px-6 py-8 text-center sm:flex-row sm:text-left">
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
              className={cn("transition-[stroke-dashoffset] duration-700 ease-out", passed ? "stroke-success" : "stroke-brand")}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-3xl font-bold text-foreground tabular-nums">{percent}%</span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {correct} / {total}
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center gap-3 sm:items-start">
          <p className="font-mono text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            {t.testSession.resultTitle}
          </p>
          <Badge tone={passed ? "success" : "danger"} className="px-3 py-1.5 text-xs">
            {passed ? <CheckIcon className="size-3.5" /> : <XIcon className="size-3.5" />}
            {passed ? t.testSession.passed : t.testSession.failed}
          </Badge>
          <p className="text-sm text-muted-foreground">
            {mode === "exam"
              ? t.testSession.examPassRule(EXAM_PASS_CORRECT, total)
              : t.testSession.passRule(PASS_PERCENT)}
          </p>
        </div>
      </Card>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t.testSession.correctLabel} value={String(correct)} tone="success" />
        <Stat label={t.testSession.wrongLabel} value={String(wrong)} tone="danger" />
        <Stat label={t.testSession.unansweredLabel} value={String(unanswered)} tone="muted" />
        <Stat label={t.testSession.timeSpent} value={formatClock(elapsedSec)} tone="muted" />
      </dl>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Button
          variant="primary"
          size="lg"
          disabled={mistakes.length === 0}
          onClick={() => onRetryWrong(mistakes.map(({ question }) => question.id))}
          className="sm:flex-1"
        >
          <TargetIcon className="size-4.5" />
          {t.testSession.retryWrong}
        </Button>
        <Button variant="secondary" size="lg" onClick={onRestart}>
          <RotateCcwIcon className="size-4.5" />
          {t.testSession.restart}
        </Button>
        <Link href="/kabinet" className={buttonClasses({ variant: "ghost", size: "lg" })}>
          {t.kabinet.backToKabinet}
        </Link>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center justify-between gap-3 font-display text-base font-bold text-foreground">
          {t.testSession.wrongListTitle}
          <Badge tone={mistakes.length > 0 ? "danger" : "success"}>{mistakes.length}</Badge>
        </h2>
        {mistakes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t.testSession.noWrong}</p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {mistakes.map(({ question, index, answer }) => {
              const text = localize(question.text, locale);
              const selected = question.options.find((o) => o.id === answer?.selectedOptionId);
              const correctOption = question.options.find((o) => o.id === answer?.result?.correctOptionId);
              return (
                <li key={question.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <Image
                    src={question.imageUrl}
                    alt=""
                    width={112}
                    height={72}
                    sizes="112px"
                    className="h-[4.5rem] w-28 shrink-0 rounded-xl border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold text-muted-foreground uppercase">
                      {t.testSession.questionNumber(index + 1)}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-foreground">
                      {text || t.testSession.imageOnlyQuestion}
                    </p>
                    {selected ? (
                      <p className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
                        <XIcon className="mt-0.5 size-3.5 shrink-0" aria-label={t.testSession.yourAnswer} />
                        {localize(selected.text, locale)}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-sm text-muted-foreground">{t.testSession.unansweredLabel}</p>
                    )}
                    {correctOption && (
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-success">
                        <CheckIcon className="mt-0.5 size-3.5 shrink-0" aria-label={t.testSession.correctAnswer} />
                        {localize(correctOption.text, locale)}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "success" | "danger" | "muted" }) {
  return (
    <Card className="px-4 py-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 font-mono text-xl font-bold tabular-nums",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger",
          tone === "muted" && "text-foreground",
        )}
      >
        {value}
      </dd>
    </Card>
  );
}

/** Vaqt tugadi: natija ko'rsatilgach bir necha soniyadan so'ng kabinetga o'tish. */
function TimeUpBanner() {
  const { t } = useLocale();
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(TIME_UP_REDIRECT_SEC);

  useEffect(() => {
    const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    const redirect = setTimeout(() => router.push("/kabinet"), TIME_UP_REDIRECT_SEC * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(redirect);
    };
  }, [router]);

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-danger/40 bg-danger/10 px-5 py-4 text-center sm:flex-row sm:text-left"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
        <AlarmClockOffIcon className="size-5" />
      </span>
      <div className="flex-1">
        <p className="font-display text-lg font-bold text-foreground">{t.testSession.timeUp}</p>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t.testSession.redirecting(secondsLeft)}
        </p>
      </div>
      <Link href="/kabinet" className={buttonClasses({ variant: "primary", size: "sm" })}>
        {t.testSession.goToKabinet}
      </Link>
    </div>
  );
}

const CONFETTI_COLORS = ["var(--brand)", "var(--brand-2)", "var(--success)", "var(--info)", "var(--warning)"];

/** Bir martalik yengil konfetti (CSS). prefers-reduced-motion'da ko'rsatilmaydi. */
function Confetti() {
  const reduceMotion = useReducedMotion();
  const [pieces] = useState(() =>
    Array.from({ length: 36 }, (_, i) => ({
      left: `${(i * 97) % 100}%`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      x: `${((i * 53) % 21) - 10}vw`,
      r: `${360 + ((i * 71) % 360)}deg`,
      d: `${2.2 + ((i * 37) % 12) / 10}s`,
      delay: `${((i * 29) % 10) / 20}s`,
    })),
  );
  if (reduceMotion) return null;

  return (
    <div aria-hidden="true">
      {pieces.map((piece, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: piece.left,
              background: piece.color,
              animationDelay: piece.delay,
              "--confetti-x": piece.x,
              "--confetti-r": piece.r,
              "--confetti-d": piece.d,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
