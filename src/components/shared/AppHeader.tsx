import type { ReactNode } from "react";
import { Logo } from "./Logo";
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
        "sticky top-[var(--reset-banner-h,0px)] z-30 border-b border-border bg-background/75 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl",
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

/** Brend belgisi — logotip emblemasi (qalqon). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center", className)}>
      <Logo variant="emblem" priority className="size-9" />
    </span>
  );
}
