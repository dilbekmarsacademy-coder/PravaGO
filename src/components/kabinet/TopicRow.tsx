"use client";

import Link from "next/link";
import { CheckIcon, LockIcon, PlayIcon } from "lucide-react";
import { PASS_PERCENT } from "@/config/rules";
import { topicHref } from "@/data/curriculum";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import type { TopicViewState } from "@/lib/progress/unlock";
import { Badge } from "@/components/shared/Badge";

interface TopicRowProps {
  topicState: TopicViewState;
}

export default function TopicRow({ topicState }: TopicRowProps) {
  const { locale, t } = useLocale();
  const { topic, completed, unlocked, bestPercent } = topicState;

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
        <span className="block text-sm font-medium text-foreground/90">
          {localize(topic.title, locale)}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[0.68rem] text-muted-foreground">
          <span className="text-brand/90">{t.kabinet.topic.testNo(topic.number)}</span>
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
