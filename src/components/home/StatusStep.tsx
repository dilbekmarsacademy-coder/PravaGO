"use client";

import { useState } from "react";
import { DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import RetroButton from "./RetroButton";
import type { ExamStatus } from "./types";

interface StatusStepProps {
  initialValue: ExamStatus | null;
  onSubmit: (value: ExamStatus) => void;
}

const OPTIONS: { value: ExamStatus; label: string; hint: string }[] = [
  {
    value: "first-time",
    label: "Birinchi marta topshiraman",
    hint: "Hali imtihonga kirmagansiz",
  },
  {
    value: "failed-before",
    label: "Oldin imtihondan yiqilganman",
    hint: "Nazariy yoki amaliy qismidan qayta topshirasiz",
  },
  {
    value: "license-revoked",
    label: "Guvohnomam bekor qilingan",
    hint: "Guvohnoma sud yoki boshqa sabab bilan bekor qilingan",
  },
];

export default function StatusStep({ initialValue, onSubmit }: StatusStepProps) {
  const [selected, setSelected] = useState<ExamStatus | null>(initialValue);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-stop">
          Bosqich 2/4
        </span>
        <DialogTitle className="mt-1 font-display text-3xl uppercase tracking-wide text-ink">
          Holatingizni tanlang
        </DialogTitle>
      </div>

      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Imtihon holati">
        {OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(option.value)}
              className={cn(
                "flex flex-col gap-0.5 border-2 px-4 py-3 text-left transition-colors",
                isSelected
                  ? "border-ink bg-primary text-ink shadow-[4px_4px_0_0_var(--stop)]"
                  : "border-ink/50 bg-transparent text-ink hover:border-ink",
              )}
            >
              <span className="font-display text-base uppercase tracking-wide">
                {option.label}
              </span>
              <span className="text-xs text-ink/70">{option.hint}</span>
            </button>
          );
        })}
      </div>

      <RetroButton
        type="button"
        surface="paper"
        disabled={!selected}
        onClick={() => selected && onSubmit(selected)}
        className="self-start"
      >
        Davom etish
      </RetroButton>
    </div>
  );
}
