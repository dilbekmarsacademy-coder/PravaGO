import type { ReactNode } from "react";
import { GaugeIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  children: ReactNode;
  /** Kontent kengligi: kabinet — "narrow", test sahifasi — "wide". */
  width?: "narrow" | "wide";
  className?: string;
}

/** Kabinet va test sahifasi uchun yagona sticky header qobig'i. */
export function AppHeader({ children, width = "narrow", className }: AppHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border bg-background/75 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6",
          width === "wide" ? "max-w-7xl" : "max-w-4xl",
        )}
      >
        {children}
      </div>
    </header>
  );
}

/** Brend belgisi (logo doirasi). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "glow-orange flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-brand-foreground",
        className,
      )}
    >
      <GaugeIcon className="size-4.5" strokeWidth={2.4} />
    </span>
  );
}
