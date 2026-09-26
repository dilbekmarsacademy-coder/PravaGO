"use client";

import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon, ListChecksIcon, VideoIcon } from "lucide-react";
import { PASS_PERCENT } from "@/config/rules";
import { topicHref } from "@/data/curriculum";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import type { ContinueTarget } from "@/lib/progress/unlock";
import { Card } from "@/components/shared/Card";
import { buttonClasses } from "@/components/shared/Button";

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
    <Card className="relative overflow-hidden p-6 sm:p-7">
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-brand/20 blur-[80px]"
        aria-hidden="true"
      />

      <span className="font-mono text-xs tracking-[0.24em] text-brand uppercase">
        {labels.eyebrow}
      </span>

      <div className="mt-3 flex items-start gap-4">
        <span className="glow-orange flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-background">
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
        className={buttonClasses({ variant: "primary", size: "md", className: "mt-6" })}
      >
        {labels.cta}
        <ArrowRightIcon className="size-4" />
      </Link>
    </Card>
  );
}
