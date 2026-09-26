import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "brand" | "success" | "danger" | "warning" | "muted";

const TONES: Record<BadgeTone, string> = {
  brand: "bg-brand/15 text-brand",
  success: "bg-success/15 text-success",
  danger: "bg-danger/15 text-danger",
  warning: "bg-warning/15 text-warning",
  muted: "bg-foreground/5 text-muted-foreground",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** Holat yorlig'i (Joriy / Tugagan / Qulflangan, O'tdi / O'tmadi ...). */
export function Badge({ tone = "muted", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[0.65rem] font-bold tracking-wide uppercase",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
