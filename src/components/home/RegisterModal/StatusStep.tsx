"use client";

import { useState } from "react";
import { CarFrontIcon, IdCardLanyardIcon, OctagonAlertIcon } from "lucide-react";
import { DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExamStatus } from "../types";

interface StatusStepProps {
  stepLabel: string;
  initialValue: ExamStatus | null;
  onSubmit: (value: ExamStatus) => void;
}

const OPTIONS: {
  value: ExamStatus;
  icon: typeof CarFrontIcon;
  label: string;
  hint: string;
  color: string;
  ring: string;
}[] = [
  {
    value: "first-time",
    icon: CarFrontIcon,
    label: "Birinchi marta topshiraman",
    hint: "Hali imtihonga kirmaganman",
    color: "text-neon-green",
    ring: "bg-neon-green/10",
  },
  {
    value: "failed-before",
    icon: OctagonAlertIcon,
    label: "Oldin imtihondan yiqilganman",
    hint: "Qayta tayyorlanmoqchiman",
    color: "text-neon-amber",
    ring: "bg-neon-amber/10",
  },
  {
    value: "license-revoked",
    icon: IdCardLanyardIcon,
    label: "Guvohnomam bekor qilingan",
    hint: "Qayta imtihonga tayyorlanyapman",
    color: "text-neon-red",
    ring: "bg-neon-red/10",
  },
];

export default function StatusStep({ stepLabel, initialValue, onSubmit }: StatusStepProps) {
  const [selected, setSelected] = useState<ExamStatus | null>(initialValue);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs tracking-[0.24em] text-neon-orange uppercase">
          {stepLabel}
        </span>
        <DialogTitle className="mt-1 font-display text-2xl font-bold text-foreground">
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
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                isSelected
                  ? "border-neon-orange/50 bg-white/[0.06]"
                  : "border-border bg-white/[0.02] hover:border-white/20",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  option.ring,
                  option.color,
                )}
              >
                <option.icon className="size-4.5" />
              </span>
              <span className="flex flex-col">
                <span className="font-display text-sm font-bold text-foreground">
                  {option.label}
                </span>
                <span className="text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <Button
        type="button"
        disabled={!selected}
        onClick={() => selected && onSubmit(selected)}
        className="glow-orange-hover h-auto self-start rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 py-2.5 text-sm font-bold text-background"
      >
        Davom etish
      </Button>
    </div>
  );
}
