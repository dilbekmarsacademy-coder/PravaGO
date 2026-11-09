"use client";

import Link from "next/link";
import { ClockIcon, MailIcon, PhoneIcon, SendIcon } from "lucide-react";
import { useLocale } from "@/lib/i18n/useLocale";
import { Logo } from "@/components/shared/Logo";
import { BUSINESS, EMAIL_HREF, INSTAGRAM_URL, PHONE_HREF } from "@/config/business";
import type { Requisites } from "@/config/requisites.server";
import PaymentLogos from "@/components/legal/PaymentLogos";

/** Ommaviy sahifalar — footer'da har doim ko'rinadi (to'lov tizimlari talabi). */
export const LEGAL_LINKS = [
  { href: "/tariflar", key: "tariffs" },
  { href: "/oferta", key: "offer" },
  { href: "/qaytarish", key: "refund" },
  { href: "/maxfiylik", key: "privacy" },
  { href: "/aloqa", key: "contact" },
] as const;

/**
 * Sayt footer'i. Rekvizitlar serverda tekshirilib props bilan keladi
 * (SiteFooter) — STIR noto'g'ri bo'lsa `stir` null va qator ko'rinmaydi.
 */
export default function Footer({ requisites }: { requisites: Pick<Requisites, "sellerName" | "stir" | "address"> }) {
  const { t } = useLocale();

  // Bosh sahifa bo'limlari: boshqa sahifadan ham ishlaydi ("/#...").
  const footerLinks = [
    { href: "/#bosh-sahifa", label: t.header.nav.boshSahifa },
    { href: "/#dastur", label: t.header.nav.dastur },
    { href: "/#qanday-ishlaydi", label: t.header.nav.qandayIshlaydi },
    { href: "/#natijalar", label: t.header.nav.natijalar },
    { href: "/tariflar", label: t.footer.links.tariffs },
  ];

  const linkClass = "text-sm text-muted-foreground transition-colors hover:text-neon-cyan";

  return (
    <footer id="biz-haqimizda" className="scroll-mt-20 border-t border-border px-5 py-12 sm:px-8" data-testid="site-footer">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Link href="/" aria-label={t.header.brand}>
            <Logo className="h-10" />
          </Link>
          <p className="text-xs text-muted-foreground">{t.footer.tagline}</p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {footerLinks.map((link) => (
            <a key={link.href} href={link.href} className={linkClass}>
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl gap-8 text-center sm:grid-cols-2 sm:text-left">
        <div>
          <h2 className="font-mono text-xs tracking-[0.2em] text-neon-orange uppercase">{t.footer.legalTitle}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClass}>
                  {t.footer.links[link.key]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-mono text-xs tracking-[0.2em] text-neon-orange uppercase">{t.footer.contactsTitle}</h2>
          <ul className="mt-3 flex flex-col items-center gap-2 sm:items-start">
            <li>
              <a href={PHONE_HREF} className={`${linkClass} inline-flex items-center gap-2`}>
                <PhoneIcon className="size-4 shrink-0" />
                {BUSINESS.phone}
              </a>
            </li>
            <li>
              <a href={EMAIL_HREF} className={`${linkClass} inline-flex items-center gap-2 break-all`}>
                <MailIcon className="size-4 shrink-0" />
                {BUSINESS.email}
              </a>
            </li>
            <li>
              <a href={BUSINESS.telegram} target="_blank" rel="noopener noreferrer" className={`${linkClass} inline-flex items-center gap-2`}>
                <SendIcon className="size-4 shrink-0" />
                Telegram
              </a>
            </li>
            <li className="flex flex-wrap justify-center gap-x-4 gap-y-1 sm:justify-start">
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                Instagram
              </a>
              <a href={BUSINESS.youtube} target="_blank" rel="noopener noreferrer" className={linkClass}>
                YouTube
              </a>
            </li>
            <li className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <ClockIcon className="size-4 shrink-0" />
              {t.footer.workingHours}: {BUSINESS.workingHours}
            </li>
          </ul>
        </div>
      </div>

      <PaymentLogos className="mx-auto mt-8 max-w-6xl justify-center sm:justify-start" />

      <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">{t.footer.about}</p>

      <p className="mx-auto mt-6 max-w-4xl text-center text-xs leading-relaxed text-muted-foreground" data-testid="footer-requisites">
        {requisites.sellerName}
        {requisites.stir && (
          <>
            {" · "}
            {t.footer.stir}: {requisites.stir}
          </>
        )}
        {" · "}
        {requisites.address}
      </p>

      <p className="mt-3 text-center font-mono text-xs text-muted-foreground/70">{t.footer.copyright}</p>
    </footer>
  );
}
