"use client";

import { useState } from "react";
import { GaugeIcon, MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";
import ThemeToggle from "@/components/shared/ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";

interface HeaderProps {
  onRegisterClick: () => void;
}

export default function Header({ onRegisterClick }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useLocale();

  const navLinks = [
    { href: "#bosh-sahifa", label: t.header.nav.boshSahifa },
    { href: "#dastur", label: t.header.nav.dastur },
    { href: "#qanday-ishlaydi", label: t.header.nav.qandayIshlaydi },
    { href: "#natijalar", label: t.header.nav.natijalar },
    { href: "#narxlar", label: t.header.nav.narxlar },
    { href: "#biz-haqimizda", label: t.header.nav.bizHaqimizda },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-5 sm:px-8">
        <a href="#bosh-sahifa" className="flex shrink-0 items-center gap-2.5">
          <span className="glow-orange flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 text-background">
            <GaugeIcon className="size-4.5" strokeWidth={2.4} />
          </span>
          <span className="font-display text-sm font-bold tracking-wide text-foreground uppercase">
            {t.header.brand}
          </span>
        </a>

        <nav className="hidden items-center gap-4 lg:flex xl:gap-5">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-neon-cyan"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex xl:gap-2.5">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button
            onClick={onRegisterClick}
            className="glow-orange-hover h-auto shrink-0 rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-5 py-2.5 text-sm font-bold whitespace-nowrap text-background hover:from-neon-orange hover:to-neon-orange-2"
          >
            {t.header.royxatdanOtish}
          </Button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground"
            aria-label={menuOpen ? t.header.menyuniYopish : t.header.menyuniOchish}
          >
            {menuOpen ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "grid overflow-hidden border-b border-border bg-background/95 backdrop-blur-xl transition-all duration-300 lg:hidden",
          menuOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="flex flex-col gap-1 overflow-hidden px-5 py-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-neon-cyan"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-2 border-t border-border pt-3">
            <Button
              onClick={() => {
                setMenuOpen(false);
                onRegisterClick();
              }}
              className="h-auto w-full rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-4 py-2.5 text-sm font-bold text-background"
            >
              {t.header.royxatdanOtish}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
