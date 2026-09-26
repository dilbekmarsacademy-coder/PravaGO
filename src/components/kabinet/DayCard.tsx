"use client";

import { CheckIcon, ChevronDownIcon, LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";
import type { DayViewState } from "@/lib/progress/unlock";
import TopicRow from "./TopicRow";

interface DayCardProps {
  dayState: DayViewState;
  expanded: boolean;
  onToggle: () => void;
}

export default function DayCard({ dayState, expanded, onToggle }: DayCardProps) {
  const { t } = useLocale();
  const labels = t.kabinet.curriculum;
  const { day, topics, unlocked, completed } = dayState;

  const statusBadge = completed ? (
    <span className="flex items-center gap-1 rounded-full bg-neon-green/15 px-2.5 py-1 font-mono text-[0.65rem] font-bold text-neon-green uppercase">
      <CheckIcon className="size-3" /> {labels.status.completed}
    </span>
  ) : unlocked ? (
    <span className="rounded-full bg-neon-orange/15 px-2.5 py-1 font-mono text-[0.65rem] font-bold text-neon-orange uppercase">
      {labels.status.current}
    </span>
  ) : (
    <span className="flex items-center gap-1 rounded-full bg-foreground/5 px-2.5 py-1 font-mono text-[0.65rem] font-bold text-muted-foreground uppercase">
      <LockIcon className="size-3" /> {labels.status.locked}
    </span>
  );

  const completedCount = topics.filter((topic) => topic.completed).length;
  const questionCount = topics.reduce((sum, topic) => sum + topic.topic.questionCount, 0);
  const percent = topics.length > 0 ? Math.round((completedCount / topics.length) * 100) : 0;
  // Qulflangan kunning mavzularini ham ko'rish mumkin (ular ichida qulflangan holda).
  const canExpand = topics.length > 0;
  const isOpen = canExpand && expanded;

  return (
    <div className={cn("glass overflow-hidden rounded-2xl", !unlocked && "opacity-80")}>
      <button
        type="button"
        onClick={canExpand ? onToggle : undefined}
        disabled={!canExpand}
        aria-expanded={isOpen}
        className="flex w-full cursor-pointer flex-col gap-3 px-5 py-4 text-left"
      >
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="font-display text-base font-bold text-foreground">
              {labels.dayTitle(day.number)}
            </span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {labels.dayQuestions(questionCount)}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {statusBadge}
            {canExpand && (
              <ChevronDownIcon
                className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")}
              />
            )}
          </div>
        </div>

        <div className="flex w-full items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/5"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={labels.dayProgressAria(day.number)}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                completed ? "bg-neon-green" : "bg-gradient-to-r from-neon-orange to-neon-orange-2",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {completedCount}/{topics.length}
          </span>
        </div>
      </button>

      <div
        className={cn(
          "grid transition-all duration-300",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-1 border-t border-border px-3 py-3">
            {topics.map((topicState) => (
              <TopicRow key={topicState.topic.id} topicState={topicState} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
