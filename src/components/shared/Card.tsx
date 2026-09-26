import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Yagona karta sirti — `.glass` (surface + blur + border) va kabinet radiusi. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-2xl", className)} {...props} />;
}
