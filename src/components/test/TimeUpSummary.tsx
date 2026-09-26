"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlarmClockOffIcon, ArrowRightIcon } from "lucide-react";
import { TIME_UP_REDIRECT_SEC } from "@/config/rules";
import { useLocale } from "@/lib/i18n/useLocale";

interface TimeUpSummaryProps {
  correctCount: number;
  total: number;
}

/** Vaqt tugaganda: natija + bir necha soniyadan so'ng kabinetga avtomatik o'tish. */
export function TimeUpSummary({ correctCount, total }: TimeUpSummaryProps) {
  const { t } = useLocale();
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(TIME_UP_REDIRECT_SEC);
  const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    const redirect = setTimeout(() => router.push("/kabinet"), TIME_UP_REDIRECT_SEC * 1000);
    return () => {
      clearInterval(id);
      clearTimeout(redirect);
    };
  }, [router]);

  return (
    <div
      role="alert"
      className="glass flex flex-col items-center gap-4 rounded-2xl border-neon-red/40 px-6 py-10 text-center"
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-neon-red/15 text-neon-red">
        <AlarmClockOffIcon className="size-8" />
      </span>
      <h2 className="font-display text-2xl font-bold text-foreground">{t.testSession.timeUp}</h2>
      <div>
        <p className="text-sm text-muted-foreground">{t.testSession.resultTitle}</p>
        <p className="mt-1 font-display text-3xl font-bold text-neon-orange">
          {t.testSession.resultScore(correctCount, total, percent)}
        </p>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t.testSession.redirecting(secondsLeft)}
      </p>
      <Link
        href="/kabinet"
        className="glow-orange-hover inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 py-2.5 text-sm font-bold text-background"
      >
        {t.testSession.goToKabinet}
        <ArrowRightIcon className="size-4" />
      </Link>
    </div>
  );
}
