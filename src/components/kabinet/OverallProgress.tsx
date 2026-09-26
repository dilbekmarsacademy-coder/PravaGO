"use client";

import { useLocale } from "@/lib/i18n/useLocale";
import type { DayViewState } from "@/lib/progress/unlock";
import { Card } from "@/components/shared/Card";

interface OverallProgressProps {
  days: DayViewState[];
}

export default function OverallProgress({ days }: OverallProgressProps) {
  const { t } = useLocale();
  const labels = t.kabinet.overall;
  const regularDays = days.filter((d) => !d.day.isFinalExam);
  const allTopics = regularDays.flatMap((d) => d.topics);
  const completedTopics = allTopics.filter((t) => t.completed).length;
  const totalTopics = allTopics.length;
  const percent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  const completedDays = regularDays.filter((d) => d.completed).length;

  return (
    <Card className="p-6 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-xs tracking-[0.24em] text-info uppercase">
          {labels.eyebrow}
        </span>
        <span className="font-mono text-sm font-bold text-foreground tabular-nums">{percent}%</span>
      </div>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/5"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={labels.ariaLabel}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand to-info transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5">
        <div>
          <p className="font-mono text-xl font-bold text-foreground tabular-nums">
            {completedTopics}/{totalTopics}
          </p>
          <p className="text-xs text-muted-foreground">{labels.completedTopics}</p>
        </div>
        <div>
          <p className="font-mono text-xl font-bold text-foreground tabular-nums">
            {completedDays}/{regularDays.length}
          </p>
          <p className="text-xs text-muted-foreground">{labels.completedDays}</p>
        </div>
      </div>
    </Card>
  );
}
