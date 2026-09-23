"use client";

import { GaugeIcon, LogOutIcon } from "lucide-react";
import type { ExamStatus } from "@/components/home/types";
import { CATEGORY_PRICES } from "@/config/prices";

interface DashboardHeaderProps {
  firstName: string;
  lastName: string;
  examStatus: ExamStatus;
  onLogout: () => void;
}

export default function DashboardHeader({
  firstName,
  lastName,
  examStatus,
  onLogout,
}: DashboardHeaderProps) {
  const category = CATEGORY_PRICES[examStatus];

  return (
    <header className="border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="glow-orange flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 text-background">
            <GaugeIcon className="size-4.5" strokeWidth={2.4} />
          </span>
          <span className="hidden font-display text-sm font-bold tracking-wide text-foreground uppercase sm:inline">
            PravaTayyor
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0 text-right">
            <p className="truncate font-display text-sm font-bold text-foreground">
              {firstName} {lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{category.label}</p>
          </div>

          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-neon-green/15 px-2.5 py-1 font-mono text-[0.65rem] font-bold tracking-wide text-neon-green uppercase">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-neon-green opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-neon-green" />
            </span>
            Faol
          </span>

          <button
            type="button"
            onClick={onLogout}
            aria-label="Chiqish"
            title="Chiqish"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-neon-red/50 hover:text-neon-red"
          >
            <LogOutIcon className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
