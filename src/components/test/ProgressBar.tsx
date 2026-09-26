"use client";

import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { useLocale } from "@/lib/i18n/useLocale";

interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const { t } = useLocale();
  const value = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted-foreground">
        {t.testSession.solved(current, total)}
      </span>
      <Progress value={value}>
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>
    </div>
  );
}
