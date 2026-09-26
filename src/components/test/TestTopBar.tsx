"use client";

import Link from "next/link";
import { ArrowLeftIcon, TimerIcon } from "lucide-react";
import KabinetLanguageSelect from "@/components/kabinet/KabinetLanguageSelect";
import { useLocale } from "@/lib/i18n/useLocale";

interface TestTopBarProps {
  title: string | null;
  elapsedSec: number;
  canFinish: boolean;
  onFinish: () => void;
}

function formatElapsed(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")} : ${String(seconds).padStart(2, "0")}`;
}

export function TestTopBar({ title, elapsedSec, canFinish, onFinish }: TestTopBarProps) {
  const { t } = useLocale();

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2.5 px-4 py-3 sm:gap-3 sm:px-6">
        <Link
          href="/kabinet"
          aria-label={t.kabinet.backToKabinet}
          title={t.kabinet.backToKabinet}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
        >
          <ArrowLeftIcon className="size-4" />
        </Link>

        <button
          type="button"
          onClick={onFinish}
          disabled={!canFinish}
          className="glow-orange-hover shrink-0 rounded-full bg-gradient-to-r from-neon-orange to-neon-orange-2 px-4 py-2 text-sm font-bold text-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t.testSession.finishTest}
        </button>

        {title && (
          <h1 className="order-last line-clamp-2 w-full font-display text-sm leading-snug font-bold text-foreground sm:order-none sm:w-auto sm:max-w-xs sm:flex-1">
            {title}
          </h1>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <span
            className="flex h-9 items-center gap-1.5 rounded-full border border-neon-orange/40 px-3 font-mono text-sm font-bold text-foreground tabular-nums"
            aria-label={t.testSession.elapsed}
            title={t.testSession.elapsed}
          >
            <TimerIcon className="size-4 text-neon-orange" aria-hidden="true" />
            {formatElapsed(elapsedSec)}
          </span>
          {/* Telefonda joy tor — til kabinet header'ida ham tanlanadi. */}
          <div className="hidden sm:block">
            <KabinetLanguageSelect />
          </div>
        </div>
      </div>
    </header>
  );
}
