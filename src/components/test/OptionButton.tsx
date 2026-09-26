import { cn } from "cn";

export type OptionState = "idle" | "pending" | "correct" | "incorrect" | "dimmed";

interface OptionButtonProps {
  optionId: string;
  text: string;
  label: string;
  state: OptionState;
  disabled: boolean;
  onSelect: (optionId: string) => void;
}

export function OptionButton({ optionId, text, label, state, disabled, onSelect }: OptionButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(optionId)}
      className={cn(
        "flex w-full items-stretch overflow-hidden rounded-xl border text-left transition-colors",
        "disabled:cursor-default",
        state === "idle" && "border-border bg-foreground/[0.03] hover:border-neon-orange/50 hover:bg-neon-orange/[0.06]",
        state === "pending" && "border-neon-orange bg-neon-orange/10",
        state === "correct" && "border-neon-green bg-neon-green/10",
        state === "incorrect" && "border-neon-red bg-neon-red/10",
        state === "dimmed" && "border-border bg-foreground/[0.02] opacity-60",
      )}
    >
      <span
        className={cn(
          "flex w-12 shrink-0 items-center justify-center font-mono text-sm font-bold sm:w-14",
          state === "correct"
            ? "bg-neon-green/20 text-neon-green"
            : state === "incorrect"
              ? "bg-neon-red/20 text-neon-red"
              : "bg-neon-orange/15 text-neon-orange",
        )}
      >
        {label}
      </span>
      <span className="flex-1 px-4 py-3 text-sm leading-relaxed font-medium text-foreground sm:text-base">
        {text}
      </span>
    </button>
  );
}
