"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * idle — tanlanmagan; selected — tanlangan (tekshiruv kutilmoqda yoki imtihon rejimi);
 * correct / incorrect — mashq rejimida natija; dimmed — javobdan keyin qolgan variantlar.
 */
export type AnswerState = "idle" | "selected" | "correct" | "incorrect" | "dimmed";

interface AnswerOptionProps {
  label: string;
  text: string;
  state: AnswerState;
  disabled: boolean;
  onSelect: () => void;
}

export function AnswerOption({ label, text, state, disabled, onSelect }: AnswerOptionProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={state === "selected" || state === "correct" || state === "incorrect"}
      className={cn(
        "group flex min-h-14 w-full items-stretch overflow-hidden rounded-2xl border text-left outline-none lg:min-h-16",
        "transition-[border-color,background-color,opacity,transform] duration-200 active:scale-[0.98] disabled:cursor-default disabled:active:scale-100",
        "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        state === "idle" && "border-border bg-surface hover:border-border-strong hover:bg-surface-2",
        state === "selected" && "border-brand bg-brand/10",
        state === "correct" && "border-success bg-success/10",
        state === "incorrect" && "animate-answer-shake border-danger bg-danger/10",
        state === "dimmed" && "border-border bg-surface opacity-55",
      )}
    >
      <span
        className={cn(
          "flex w-12 shrink-0 items-center justify-center font-mono text-sm font-bold transition-colors sm:w-14",
          state === "idle" && "bg-brand/10 text-brand",
          state === "dimmed" && "bg-foreground/5 text-muted-foreground",
          state === "selected" && "bg-brand text-brand-foreground",
          state === "correct" && "bg-success text-background",
          state === "incorrect" && "bg-danger text-white",
        )}
      >
        {label}
      </span>
      <span className="flex flex-1 items-center px-4 py-3 text-[clamp(1rem,0.96rem+0.25vw,1.125rem)] leading-snug font-medium break-words text-foreground">
        {text}
      </span>
      {(state === "correct" || state === "incorrect") && (
        <span className="flex shrink-0 items-center pr-4">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full",
              state === "correct" ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
            )}
          >
            {state === "correct" ? <CheckIcon className="size-4" strokeWidth={3} /> : <XIcon className="size-4" strokeWidth={3} />}
          </span>
        </span>
      )}
    </button>
  );
}
