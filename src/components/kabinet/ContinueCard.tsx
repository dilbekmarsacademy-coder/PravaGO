"use client";

import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon, ListChecksIcon, VideoIcon } from "lucide-react";
import { PASS_PERCENT } from "@/config/rules";
import { topicHref } from "@/data/curriculum";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import type { ContinueTarget } from "@/lib/progress/unlock";

interface ContinueCardProps {
  target: ContinueTarget;
}

const STAGE_ICONS = {
  video: VideoIcon,
  pdf: BookOpenIcon,
  test: ListChecksIcon,
};

export default function ContinueCard({ target }: ContinueCardProps) {
  const { locale, t } = useLocale();
  const labels = t.kabinet.continueCard;
  const { topic } = target;
  // Test banki ulangan mavzuda tugma to'g'ridan-to'g'ri testni boshlaydi.
  const stage = topic.topic.testSlug ? "test" : topic.stage;
  const Icon = STAGE_ICONS[stage];

  const hasFailedAttempt =
    stage === "test" && topic.lastPercent !== null && topic.lastPercent < PASS_PERCENT;
  const actionLabel = hasFailedAttempt
    ? labels.retryTest(topic.lastPercent as number)
    : labels.stages[stage];

  return (
    <div className="glass relative overflow-hidden rounded-2xl p-6 sm:p-7">
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-neon-orange/20 blur-[80px]"
        aria-hidden="true"
      />

      <span className="font-mono text-xs tracking-[0.24em] text-neon-orange uppercase">
        {labels.eyebrow}
      </span>

      <div className="mt-3 flex items-start gap-4">
        <span className="glow-orange flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 text-background">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <span className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
            {labels.location(target.dayNumber, topic.topic.number)}
          </span>
          <h2 className="mt-0.5 font-display text-lg font-bold text-foreground sm:text-xl">
            {localize(topic.topic.title, locale)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{actionLabel}</p>
        </div>
      </div>

      <Link
        href={topicHref(topic.topic)}
        className="glow-orange-hover mt-6 inline-flex h-auto items-center gap-2 rounded-full bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 py-2.5 text-sm font-bold text-background"
      >
        {labels.cta}
        <ArrowRightIcon className="size-4" />
      </Link>
    </div>
  );
}
