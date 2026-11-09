"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { Logo } from "@/components/shared/Logo";

const NAV = [
  { href: "/tariflar", label: "Tariflar" },
  { href: "/aloqa", label: "Aloqa" },
];

/** Ommaviy sahifalar (/tariflar, /oferta ...) sarlavhasi: logo, qisqa menyu, mavzu. */
export default function PublicHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
        <Link href="/" aria-label="PravaIshonch — bosh sahifa" className="flex shrink-0 items-center">
          <Logo priority className="h-8 sm:h-10" />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition-colors hover:text-neon-cyan",
                pathname === item.href ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/"
            aria-label="Bosh sahifa"
            className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan sm:inline-flex"
          >
            <HomeIcon className="size-4" />
            Bosh sahifa
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
