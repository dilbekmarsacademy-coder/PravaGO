import { FlagIcon, LockIcon } from "lucide-react";
import type { ExamStatus } from "@/components/home/types";
import { FINAL_EXAM_FLOW_ENABLED } from "@/config/rules";

interface FinalExamCardProps {
  examStatus: ExamStatus;
  attemptsUsed: number;
  maxAttempts: number;
  unlocked: boolean;
}

export default function FinalExamCard({
  examStatus,
  attemptsUsed,
  maxAttempts,
  unlocked,
}: FinalExamCardProps) {
  const format =
    examStatus === "first-time"
      ? { questions: 20, minutes: 25 }
      : { questions: 50, minutes: 45 };

  // TZ: yakuniy imtihon oqimi hali qurilmagani sababli kartochka hozircha
  // doim qulflangan holatda ko'rsatiladi (FINAL_EXAM_FLOW_ENABLED — config/rules.ts).
  const isAvailable = FINAL_EXAM_FLOW_ENABLED && unlocked;

  return (
    <div
      className="glass flex items-center justify-between gap-4 rounded-2xl px-5 py-4"
      aria-disabled={!isAvailable}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground">
          {isAvailable ? <FlagIcon className="size-4.5" /> : <LockIcon className="size-4.5" />}
        </span>
        <div>
          <p className="font-display text-sm font-bold text-foreground">{"7-kun — Yakuniy imtihon"}</p>
          <p className="text-xs text-muted-foreground">
            {format.questions} savol / {format.minutes} daqiqa &middot; urinishlar {attemptsUsed}/
            {maxAttempts}
          </p>
        </div>
      </div>

      <span className="shrink-0 rounded-full bg-foreground/5 px-2.5 py-1 font-mono text-[0.65rem] font-bold text-muted-foreground uppercase">
        {isAvailable ? "Ochiq" : "Qulflangan"}
      </span>
    </div>
  );
}
