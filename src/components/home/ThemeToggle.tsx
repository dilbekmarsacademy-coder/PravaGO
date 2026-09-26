"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

// Bloklovchi <head> skripti ham "dark"ni sukut bo'yicha tanlaydi — mos keladi.
function getServerSnapshot(): Theme {
  return "dark";
}

function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // localStorage mavjud bo'lmasa (masalan, shaxsiy oynada) e'tiborsiz qoldiramiz.
  }
  listeners.forEach((listener) => listener());
}

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { t } = useLocale();
  const label = theme === "dark" ? t.theme.toLight : t.theme.toDark;

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan",
        className,
      )}
    >
      {theme === "dark" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </button>
  );
}
