"use client";

import { GaugeIcon } from "lucide-react";
import { useLocale } from "@/lib/i18n/useLocale";

export default function Footer() {
  const { t } = useLocale();

  const footerLinks = [
    { href: "#bosh-sahifa", label: t.header.nav.boshSahifa },
    { href: "#dastur", label: t.header.nav.dastur },
    { href: "#qanday-ishlaydi", label: t.header.nav.qandayIshlaydi },
    { href: "#natijalar", label: t.header.nav.natijalar },
    { href: "#narxlar", label: t.header.nav.narxlar },
  ];

  return (
    <footer
      id="biz-haqimizda"
      className="scroll-mt-20 border-t border-border px-5 py-12 sm:px-8"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 text-background">
            <GaugeIcon className="size-4.5" strokeWidth={2.4} />
          </span>
          <div>
            <p className="font-display text-sm font-bold tracking-wide text-foreground uppercase">
              {t.header.brand}
            </p>
            <p className="text-xs text-muted-foreground">{t.footer.tagline}</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {footerLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-neon-cyan"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <p className="mt-8 text-center font-mono text-xs text-muted-foreground/70">
        {t.footer.copyright}
      </p>
    </footer>
  );
}
