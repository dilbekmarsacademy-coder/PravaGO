"use client";

import Link from "next/link";
import { CheckIcon, ChevronRightIcon, ClockIcon, LockIcon, PlayCircleIcon, PlayIcon } from "lucide-react";
import { PASS_PERCENT } from "@/config/rules";
import { topicHref } from "@/data/curriculum";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { isTopicComingSoon, type TopicViewState } from "@/lib/progress/unlock";
import { Badge } from "@/components/shared/Badge";
import { cn } from "@/lib/utils";

interface TopicRowProps {
  topicState: TopicViewState;
}

export default function TopicRow({ topicState }: TopicRowProps) {
  const { locale, t } = useLocale();
  const { topic, completed, unlocked, bestPercent } = topicState;

  if (isTopicComingSoon(topic) && unlocked) {
    return <ComingSoonTopicRow topicState={topicState} />;
  }
  if (topic.lessonId && !topic.testSlug && unlocked) {
    return <VideoTopicRow topicState={topicState} />;
  }

  const statusIcon = completed ? (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
      <CheckIcon className="size-3.5" />
    </span>
  ) : unlocked ? (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
      <PlayIcon className="size-3.5" />
    </span>
  ) : (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground">
      <LockIcon className="size-3.5" />
    </span>
  );

  const content = (
    <>
      {statusIcon}
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug font-medium break-words text-foreground/90">
          {localize(topic.title, locale)}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[0.68rem] text-muted-foreground">
          <span className="text-brand/90">{t.kabinet.topic.order(topic.order)}</span>
          <span aria-hidden="true">&middot;</span>
          <span className="tabular-nums">{t.kabinet.topic.questions(topic.questionCount)}</span>
        </span>
      </span>
      {bestPercent !== null ? (
        <Badge tone={completed ? "success" : "warning"} className="px-2 py-0.5 normal-case tabular-nums">
          {bestPercent}%
        </Badge>
      ) : (
        unlocked && (
          <span className="shrink-0 text-[0.65rem] text-muted-foreground">
            {t.kabinet.topic.notStarted}
          </span>
        )
      )}
    </>
  );

  if (!unlocked) {
    return (
      <div
        role="button"
        aria-disabled="true"
        title={t.kabinet.topic.lockedHint(PASS_PERCENT)}
        className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 opacity-50"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={topicHref(topic)}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-foreground/5"
    >
      {content}
    </Link>
  );
}

/** Video va testi hali qo'shilmagan mavzu: tartib raqami, nom va "Tez orada". */
function ComingSoonTopicRow({ topicState }: TopicRowProps) {
  const { locale, t } = useLocale();
  const { topic } = topicState;

  return (
    <Link
      href={topicHref(topic)}
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-foreground/5"
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-brand/30 bg-brand/10 font-mono text-xs font-bold text-brand tabular-nums"
        aria-hidden="true"
      >
        {topic.order}
      </span>
      <span className="min-w-0 flex-1">
        <span className="sr-only">{t.kabinet.topic.order(topic.order)}: </span>
        <span className="block text-sm leading-snug font-medium break-words text-foreground/90">
          {localize(topic.title, locale)}
        </span>
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[0.62rem] font-bold tracking-wide text-brand/90 uppercase">
          <ClockIcon className="size-3" aria-hidden="true" />
          {t.kabinet.topic.comingSoon}
        </span>
      </span>
      <ChevronRightIcon
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

/**
 * Video darsli (testi hali ulanmagan) mavzu: tartib raqami, nom va server
 * bergan ko'rish foizi — "Ko'rildi: N%" yoki "Ko'rildi ✓".
 */
function VideoTopicRow({ topicState }: TopicRowProps) {
  const { locale, t } = useLocale();
  const { topic, progress, completed } = topicState;
  const percent = progress?.videoPercent;
  const labels = t.kabinet.topic;

  return (
    <Link
      href={topicHref(topic)}
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-foreground/5"
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold tabular-nums",
          completed ? "border-success/30 bg-success/15 text-success" : "border-brand/30 bg-brand/10 text-brand",
        )}
        aria-hidden="true"
      >
        {completed ? <CheckIcon className="size-4" /> : topic.order}
      </span>
      <span className="min-w-0 flex-1">
        <span className="sr-only">{labels.order(topic.order)}: </span>
        <span className="block text-sm leading-snug font-medium break-words text-foreground/90">
          {localize(topic.title, locale)}
        </span>
        {completed ? (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 font-mono text-[0.62rem] font-bold tracking-wide text-success uppercase">
            {labels.videoWatched}
          </span>
        ) : percent !== undefined ? (
          <span className="mt-1.5 flex items-center gap-2">
            <span
              className="h-1 w-20 overflow-hidden rounded-full bg-foreground/10 sm:w-28"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={labels.videoPercent(percent)}
            >
              <span
                className="block h-full rounded-full bg-gradient-to-r from-brand to-brand-2"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="font-mono text-[0.65rem] text-muted-foreground tabular-nums">
              {labels.videoPercent(percent)}
            </span>
          </span>
        ) : (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[0.62rem] font-bold tracking-wide text-brand/90 uppercase">
            <ClockIcon className="size-3" aria-hidden="true" />
            {labels.videoSoon}
          </span>
        )}
      </span>
      <PlayCircleIcon
        className="size-5 shrink-0 text-brand/80 transition-transform group-hover:scale-110"
        aria-hidden="true"
      />
    </Link>
  );
}
