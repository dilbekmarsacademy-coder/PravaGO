import { cn } from "cn";
import type { ApiOption } from "@/lib/api/test";

export type OptionState = "idle" | "selected" | "correct" | "incorrect";

interface OptionButtonProps {
  option: ApiOption;
  state: OptionState;
  disabled: boolean;
  onSelect: (optionId: string) => void;
}

export function OptionButton({ option, state, disabled, onSelect }: OptionButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(option.id)}
      className={cn(
        "w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed",
        state === "idle" &&
          "border-border bg-background hover:bg-muted disabled:opacity-50",
        state === "selected" && "border-primary bg-primary/10 text-primary",
        state === "correct" &&
          "border-[var(--neon-green)] bg-[var(--neon-green)]/15 text-[var(--neon-green)]",
        state === "incorrect" &&
          "border-destructive bg-destructive/10 text-destructive",
      )}
    >
      {option.text}
    </button>
  );
}
