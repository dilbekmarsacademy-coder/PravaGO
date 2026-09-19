"use client";

import { useState } from "react";
import { GaugeIcon, MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#bosh-sahifa", label: "Bosh sahifa" },
  { href: "#dastur", label: "Dastur" },
  { href: "#qanday-ishlaydi", label: "Qanday ishlaydi" },
  { href: "#natijalar", label: "Natijalar" },
  { href: "#biz-haqimizda", label: "Biz haqimizda" },
];

interface HeaderProps {
  onRegisterClick: () => void;
}

export default function Header({ onRegisterClick }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a href="#bosh-sahifa" className="flex items-center gap-2.5">
          <span className="glow-orange flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 text-background">
            <GaugeIcon className="size-4.5" strokeWidth={2.4} />
          </span>
          <span className="font-display text-sm font-bold tracking-wide text-foreground uppercase">
            PravaTayyor
          </span>
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-neon-cyan"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Tez orada"
            className="cursor-not-allowed rounded-full px-4 py-2 text-sm text-muted-foreground/50"
          >
            Kirish
          </button>
          <Button
            onClick={onRegisterClick}
            className="glow-orange-hover h-auto rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-5 py-2.5 text-sm font-bold text-background hover:from-neon-orange hover:to-neon-orange-2"
          >
            Ro&rsquo;yxatdan o&rsquo;tish
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex size-9 items-center justify-center rounded-full border border-border text-foreground md:hidden"
          aria-label={menuOpen ? "Menyuni yopish" : "Menyuni ochish"}
        >
          {menuOpen ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
        </button>
      </div>

      <div
        className={cn(
          "grid overflow-hidden border-b border-border bg-background/90 backdrop-blur-xl transition-all duration-300 md:hidden",
          menuOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="flex flex-col gap-1 overflow-hidden px-5 py-4">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-neon-cyan"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="cursor-not-allowed rounded-full border border-border px-4 py-2.5 text-sm text-muted-foreground/50"
            >
              Kirish
            </button>
            <Button
              onClick={() => {
                setMenuOpen(false);
                onRegisterClick();
              }}
              className="h-auto rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-4 py-2.5 text-sm font-bold text-background"
            >
              Ro&rsquo;yxatdan o&rsquo;tish
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
