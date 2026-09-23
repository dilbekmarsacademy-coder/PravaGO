"use client";

import { CheckIcon, ChevronDownIcon, LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DayViewState } from "@/lib/progress/unlock";
import TopicRow from "./TopicRow";

interface DayCardProps {
  dayState: DayViewState;
  expanded: boolean;
  onToggle: () => void;
}

export default function DayCard({ dayState, expanded, onToggle }: DayCardProps) {
  const { day, topics, unlocked, completed } = dayState;

  const statusBadge = completed ? (
    <span className="flex items-center gap-1 rounded-full bg-neon-green/15 px-2.5 py-1 font-mono text-[0.65rem] font-bold text-neon-green uppercase">
      <CheckIcon className="size-3" /> Tugagan
    </span>
  ) : unlocked ? (
    <span className="rounded-full bg-neon-orange/15 px-2.5 py-1 font-mono text-[0.65rem] font-bold text-neon-orange uppercase">
      Joriy
    </span>
  ) : (
    <span className="flex items-center gap-1 rounded-full bg-foreground/5 px-2.5 py-1 font-mono text-[0.65rem] font-bold text-muted-foreground uppercase">
      <LockIcon className="size-3" /> Qulflangan
    </span>
  );

  const completedCount = topics.filter((t) => t.completed).length;
  const canExpand = unlocked && topics.length > 0;
  const isOpen = canExpand && expanded;

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={canExpand ? onToggle : undefined}
        disabled={!canExpand}
        aria-expanded={isOpen}
        aria-disabled={!canExpand}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-5 py-4 text-left",
          canExpand ? "cursor-pointer" : "cursor-not-allowed opacity-60",
        )}
      >
        <div className="flex items-center gap-3">
          <span className="font-display text-base font-bold text-foreground">{day.title}</span>
          {topics.length > 0 && (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {completedCount}/{topics.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {statusBadge}
          {canExpand && (
            <ChevronDownIcon
              className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")}
            />
          )}
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
