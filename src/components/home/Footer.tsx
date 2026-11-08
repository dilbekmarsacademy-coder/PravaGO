"use client";

import { useLocale } from "@/lib/i18n/useLocale";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

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
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Link href="/" aria-label={t.header.brand}>
            <Logo className="h-10" />
          </Link>
          <p className="text-xs text-muted-foreground">{t.footer.tagline}</p>
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

      <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">
        {t.footer.about}
      </p>

      <p className="mt-6 text-center font-mono text-xs text-muted-foreground/70">
        {t.footer.copyright}
      </p>
    </footer>
  );
}
