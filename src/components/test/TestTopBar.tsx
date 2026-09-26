"use client";

import Link from "next/link";
import { ArrowLeftIcon, TimerIcon } from "lucide-react";
import { cn } from "cn";
import ThemeToggle from "@/components/home/ThemeToggle";
import KabinetLanguageSelect from "@/components/kabinet/KabinetLanguageSelect";
import { useLocale } from "@/lib/i18n/useLocale";
import { formatClock, type TimeUrgency } from "@/lib/test/timer";

interface TestTopBarProps {
  title: string | null;
  remainingSec: number;
  urgency: TimeUrgency;
  canFinish: boolean;
  onFinish: () => void;
}

export function TestTopBar({ title, remainingSec, urgency, canFinish, onFinish }: TestTopBarProps) {
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
            role="timer"
            aria-label={t.testSession.timeLeft}
            title={t.testSession.timeLeft}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full border px-3 font-mono text-sm font-bold tabular-nums transition-colors",
              urgency === "normal" && "border-neon-orange/40 text-foreground",
              urgency === "warning" && "border-neon-amber bg-neon-amber/15 text-neon-amber",
              urgency === "critical" && "animate-pulse border-neon-red bg-neon-red/15 text-neon-red",
            )}
          >
            <TimerIcon
              className={cn("size-4", urgency === "normal" ? "text-neon-orange" : "text-current")}
              aria-hidden="true"
            />
            {formatClock(remainingSec)}
          </span>
          {/* Telefonda joy tor — til kabinet header'ida ham tanlanadi. */}
          <div className="hidden sm:block">
            <KabinetLanguageSelect />
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
