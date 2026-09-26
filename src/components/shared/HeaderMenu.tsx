"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckIcon, EllipsisIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LOCALE_META } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import { buttonClasses } from "./Button";
import { setTheme, useTheme } from "./ThemeToggle";

interface HeaderMenuProps {
  label: string;
  /** Menyuning oxiridagi qo'shimcha amallar (masalan "Yakunlash", "Chiqish"). */
  actions?: (close: () => void) => ReactNode;
  className?: string;
}

/** Telefonda header'dagi "⋯" menyu: til, tema va qo'shimcha amallar. */
export function HeaderMenu({ label, actions, className }: HeaderMenuProps) {
  const { locale, setLocale, t } = useLocale();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const item =
    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-foreground outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={buttonClasses({ variant: "secondary", size: "icon" })}
      >
        <EllipsisIcon className="size-5" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute top-[calc(100%+0.5rem)] right-0 z-40 w-64 rounded-2xl border border-border bg-popover/95 p-2 shadow-card backdrop-blur-xl"
        >
          <p className="px-3 pt-1 pb-2 font-mono text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase">
            {t.kabinet.header.language}
          </p>
          {LOCALE_META.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={locale === option.value}
              onClick={() => {
                setLocale(option.value);
                close();
              }}
              className={item}
            >
              <span className="flex-1">{option.nativeName}</span>
              {locale === option.value && <CheckIcon className="size-4 text-brand" />}
            </button>
          ))}
          <div className="my-2 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setTheme(theme === "dark" ? "light" : "dark");
              close();
            }}
            className={item}
          >
            {theme === "dark" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
            {theme === "dark" ? t.theme.toLight : t.theme.toDark}
          </button>
          {actions && (
            <>
              <div className="my-2 h-px bg-border" />
              {actions(close)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** HeaderMenu ichidagi oddiy amal elementi. */
export function HeaderMenuItem({
  icon,
  children,
  onClick,
  tone = "default",
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2",
        tone === "danger" ? "text-danger" : "text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
