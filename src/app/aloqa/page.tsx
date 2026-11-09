import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon, SendIcon } from "lucide-react";
import { BUSINESS, EMAIL_HREF, INSTAGRAM_URL, PHONE_HREF, TELEGRAM_HANDLE } from "@/config/business";
import { getRequisites } from "@/config/requisites.server";
import { organizationLd } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/seo";
import { DocCard, DocSection, PublicPage, RequisitesList } from "@/components/legal/PublicPage";
import { requisiteRows } from "@/components/legal/requisites";

const TITLE = "Aloqa";
const DESCRIPTION = `PravaIshonch bilan bogʻlanish: telefon ${BUSINESS.phone}, Telegram, email, Instagram va YouTube. Ish vaqti: har kuni ${BUSINESS.workingHours}.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/aloqa" },
  openGraph: { title: `${TITLE} — PravaIshonch`, description: DESCRIPTION, url: `${SITE_URL}/aloqa` },
};

export default function ContactPage() {
  const requisites = getRequisites();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [organizationLd(requisites), { "@type": "ContactPage", name: TITLE, url: `${SITE_URL}/aloqa`, inLanguage: "uz", about: { "@id": `${SITE_URL}/#organization` } }],
  };
  return (
    <PublicPage eyebrow="Aloqa" title="Biz bilan bogʻlaning" lead="Savol, taklif yoki shikoyat boʻlsa — eng tezkor yoʻl Telegram. Murojaatlarga ish vaqtida javob beramiz." jsonLd={jsonLd}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="contact-cards">
        <Contact icon={SendIcon} label="Telegram" href={BUSINESS.telegram} external>
          {TELEGRAM_HANDLE}
        </Contact>
        <Contact icon={PhoneIcon} label="Telefon" href={PHONE_HREF}>
          {BUSINESS.phone}
        </Contact>
        <Contact icon={MailIcon} label="Email" href={EMAIL_HREF}>
          <span className="break-all">{BUSINESS.email}</span>
        </Contact>
        <Contact icon={InstagramGlyph} label="Instagram" href={INSTAGRAM_URL} external>
          {BUSINESS.instagram}
        </Contact>
        <Contact icon={YoutubeGlyph} label="YouTube" href={BUSINESS.youtube} external>
          {BUSINESS.youtube.replace(/^https:\/\/(www\.)?youtube\.com\//, "")}
        </Contact>
        <Contact icon={ClockIcon} label="Ish vaqti">
          Har kuni {BUSINESS.workingHours}
        </Contact>
        <Contact icon={MapPinIcon} label="Manzil" className="sm:col-span-2 lg:col-span-3">
          {BUSINESS.address}
        </Contact>
      </div>

      <div className="mt-8">
        <DocCard>
          <DocSection title="Rekvizitlar">
            <RequisitesList rows={requisiteRows(requisites)} />
          </DocSection>
        </DocCard>
      </div>
    </PublicPage>
  );
}

type IconType = (props: { className?: string }) => ReactNode;

function Contact({ icon: Icon, label, href, external, className, children }: { icon: IconType; label: string; href?: string; external?: boolean; className?: string; children: ReactNode }) {
  const body = (
    <>
      <Icon className="size-5 shrink-0 text-neon-cyan" />
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="mt-0.5 block font-semibold text-foreground">{children}</span>
      </span>
    </>
  );
  const cls = `glass flex items-start gap-3 rounded-2xl p-5 ${className ?? ""}`;
  return href ? (
    <a href={href} className={`${cls} transition-colors hover:border-neon-cyan/50`} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// lucide'da brend ikonlari yo'q — oddiy shakllar.
function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function YoutubeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" />
    </svg>
  );
}
