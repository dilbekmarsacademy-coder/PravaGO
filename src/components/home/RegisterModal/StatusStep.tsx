"use client";

import { useState } from "react";
import { CarFrontIcon, IdCardLanyardIcon, OctagonAlertIcon } from "lucide-react";
import { DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";
import type { ExamStatus } from "../types";

interface StatusStepProps {
  stepLabel: string;
  initialValue: ExamStatus | null;
  onSubmit: (value: ExamStatus) => void;
}

const ICONS: Record<ExamStatus, typeof CarFrontIcon> = {
  "first-time": CarFrontIcon,
  "failed-before": OctagonAlertIcon,
  "license-revoked": IdCardLanyardIcon,
};

const STYLES: Record<ExamStatus, { color: string; ring: string }> = {
  "first-time": { color: "text-neon-green", ring: "bg-neon-green/10" },
  "failed-before": { color: "text-neon-amber", ring: "bg-neon-amber/10" },
  "license-revoked": { color: "text-neon-red", ring: "bg-neon-red/10" },
};

export default function StatusStep({ stepLabel, initialValue, onSubmit }: StatusStepProps) {
  const [selected, setSelected] = useState<ExamStatus | null>(initialValue);
  const { t } = useLocale();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs tracking-[0.24em] text-neon-orange uppercase">
          {stepLabel}
        </span>
        <DialogTitle className="mt-1 font-display text-2xl font-bold text-foreground">
          {t.registerModal.status.title}
        </DialogTitle>
      </div>

      <div className="flex flex-col gap-3" role="radiogroup" aria-label={t.registerModal.status.ariaLabel}>
        {t.examStatusOptions.map((option) => {
          const isSelected = selected === option.value;
          const Icon = ICONS[option.value];
          const style = STYLES[option.value];
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
                  ? "border-neon-orange/50 bg-foreground/[0.06]"
                  : "border-border bg-foreground/[0.02] hover:border-foreground/20",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  style.ring,
                  style.color,
                )}
              >
                <Icon className="size-4.5" />
              </span>
              <span className="flex flex-col">
                <span className="font-display text-sm font-bold text-foreground">
                  {option.title}
                </span>
                <span className="text-xs text-muted-foreground">{option.desc}</span>
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
        {t.registerModal.status.cta}
      </Button>
    </div>
  );
}
