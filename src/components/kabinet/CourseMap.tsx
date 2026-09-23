"use client";

import { useState } from "react";
import type { ExamStatus } from "@/components/home/types";
import type { CourseState } from "@/lib/progress/unlock";
import DayCard from "./DayCard";
import FinalExamCard from "./FinalExamCard";

interface CourseMapProps {
  courseState: CourseState;
  examStatus: ExamStatus;
  examAttemptsUsed: number;
  examMaxAttempts: number;
}

export default function CourseMap({
  courseState,
  examStatus,
  examAttemptsUsed,
  examMaxAttempts,
}: CourseMapProps) {
  const regularDays = courseState.days.filter((d) => d.day.number >= 1 && d.day.number <= 6);
  const defaultOpenDay =
    courseState.continueTarget?.dayNumber ??
    regularDays.find((d) => d.unlocked && !d.completed)?.day.number ??
    regularDays[0]?.day.number ??
    null;

  const [expandedDayNumber, setExpandedDayNumber] = useState<number | null>(defaultOpenDay);

  return (
    <div>
      <span className="font-mono text-xs tracking-[0.24em] text-neon-orange uppercase">
        Dastur xaritasi
      </span>

      <div className="mt-4 flex flex-col gap-3">
        {regularDays.map((dayState) => (
          <DayCard
            key={dayState.day.id}
            dayState={dayState}
            expanded={expandedDayNumber === dayState.day.number}
            onToggle={() =>
              setExpandedDayNumber((prev) => (prev === dayState.day.number ? null : dayState.day.number))
            }
          />
        ))}

        <FinalExamCard
          examStatus={examStatus}
          attemptsUsed={examAttemptsUsed}
          maxAttempts={examMaxAttempts}
          unlocked={courseState.finalExamUnlocked}
        />
      </div>
    </div>
  );
}
