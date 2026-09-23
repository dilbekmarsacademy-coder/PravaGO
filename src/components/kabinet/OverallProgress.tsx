import type { DayViewState } from "@/lib/progress/unlock";

interface OverallProgressProps {
  days: DayViewState[];
}

export default function OverallProgress({ days }: OverallProgressProps) {
  const regularDays = days.filter((d) => d.day.number >= 1 && d.day.number <= 6);
  const allTopics = regularDays.flatMap((d) => d.topics);
  const completedTopics = allTopics.filter((t) => t.completed).length;
  const totalTopics = allTopics.length;
  const percent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  const completedDays = regularDays.filter((d) => d.completed).length;

  return (
    <div className="glass rounded-2xl p-6 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-xs tracking-[0.24em] text-neon-cyan uppercase">
          Umumiy progress
        </span>
        <span className="font-mono text-sm font-bold text-foreground tabular-nums">{percent}%</span>
      </div>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/5"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Tugatilgan mavzular foizi"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon-orange to-neon-cyan transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5">
        <div>
          <p className="font-mono text-xl font-bold text-foreground tabular-nums">
            {completedTopics}/{totalTopics}
          </p>
          <p className="text-xs text-muted-foreground">Tugatilgan mavzular</p>
        </div>
        <div>
          <p className="font-mono text-xl font-bold text-foreground tabular-nums">
            {completedDays}/6
          </p>
          <p className="text-xs text-muted-foreground">Tugatilgan kunlar</p>
        </div>
      </div>
    </div>
  );
}
