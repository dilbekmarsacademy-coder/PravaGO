"use client";

import Link from "next/link";
import { ArrowLeftIcon, FlagIcon } from "lucide-react";
import { AppHeader } from "@/components/shared/AppHeader";
import { buttonClasses } from "@/components/shared/Button";
import { HeaderMenu, HeaderMenuItem } from "@/components/shared/HeaderMenu";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { useLocale } from "@/lib/i18n/useLocale";
import type { TimeUrgency } from "@/lib/test/timer";
import { TimerRing } from "./TimerRing";

interface TestHeaderProps {
  testLabel: string | null;
  title: string | null;
  remainingSec: number;
  limitSec: number;
  urgency: TimeUrgency;
  canFinish: boolean;
  /** Test tugagach taymer yashiriladi. */
  showTimer: boolean;
  onFinish: () => void;
}

export function TestHeader({
  testLabel,
  title,
  remainingSec,
  limitSec,
  urgency,
  canFinish,
  showTimer,
  onFinish,
}: TestHeaderProps) {
  const { t } = useLocale();

  return (
    <AppHeader width="wide">
      <Link
        href="/kabinet"
        aria-label={t.kabinet.backToKabinet}
        title={t.kabinet.backToKabinet}
        className={buttonClasses({ variant: "secondary", size: "icon", className: "size-11 md:size-10" })}
      >
        <ArrowLeftIcon className="size-4.5" />
      </Link>

      {title && (
        <nav aria-label={t.kabinet.backToKabinet} className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
          {testLabel && (
            <span className="shrink-0 font-mono text-xs font-semibold tracking-wide text-brand uppercase">
              {testLabel}
            </span>
          )}
          <span className="text-muted-foreground" aria-hidden="true">
            ·
          </span>
          <h1 className="truncate text-sm font-semibold text-foreground">{title}</h1>
        </nav>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {showTimer && (
          <TimerRing remainingSec={remainingSec} limitSec={limitSec} urgency={urgency} className="md:h-10" />
        )}
        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          <ThemeToggle className="size-10" />
          <button
            type="button"
            onClick={onFinish}
            disabled={!canFinish}
            className={buttonClasses({ variant: "secondary", size: "sm", className: "h-10" })}
          >
            <FlagIcon className="size-4" />
            {t.testSession.finishShort}
          </button>
        </div>
        <HeaderMenu
          label={t.testSession.moreActions}
          className="md:hidden"
          actions={(close) =>
            canFinish ? (
              <HeaderMenuItem
                icon={<FlagIcon className="size-4 text-brand" />}
                onClick={() => {
                  close();
                  onFinish();
                }}
              >
                {t.testSession.finishTest}
              </HeaderMenuItem>
            ) : null
          }
        />
      </div>
    </AppHeader>
  );
}
