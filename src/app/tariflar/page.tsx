import type { Metadata } from "next";
import Link from "next/link";
import { GiftIcon, MonitorSmartphoneIcon, ShieldCheckIcon, UserCheckIcon } from "lucide-react";
import { BUSINESS } from "@/config/business";
import { getRequisites } from "@/config/requisites.server";
import { TARIFFS, TARIFF_RULES, UNTIL_PASSED_LABEL, formatSom, inheritsLabel, minPrice } from "@/config/tariffs";
import { organizationLd } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/seo";
import TariffCards from "@/components/tariffs/TariffCards";
import { DocSection, PublicPage } from "@/components/legal/PublicPage";

const TITLE = "Tariflar va narxlar";
const DESCRIPTION = `PravaIshonch tariflari: ${TARIFFS.map((t) => `${t.name} — ${formatSom(minPrice(t))}${t.options.length > 1 ? "dan" : ""}`).join(", ")}. ${TARIFF_RULES.trialDays} kunlik bepul sinov, haydovchilik imtihoniga onlayn tayyorgarlik.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tariflar" },
  openGraph: { title: `${TITLE} — PravaIshonch`, description: DESCRIPTION, url: `${SITE_URL}/tariflar` },
};

export default function TariffsPage() {
  const requisites = getRequisites();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationLd(requisites),
      // Har tarif varianti — alohida Offer.
      ...TARIFFS.flatMap((t) =>
        t.options.map((o) => ({
          "@type": "Offer",
          name: `PravaIshonch ${t.name}${t.options.length > 1 ? ` — ${o.label}` : ""}`,
          description: `${t.summary}. ${[inheritsLabel(t), t.features.join(", ")].filter(Boolean).join(" ")}. Muddat: ${o.durationDays ? `${o.durationDays} kun` : UNTIL_PASSED_LABEL.toLowerCase()}.`,
          price: o.price,
          priceCurrency: "UZS",
          category: BUSINESS.serviceDescription,
          url: `${SITE_URL}/tariflar`,
          seller: { "@id": `${SITE_URL}/#organization` },
          ...(o.durationDays ? { eligibleDuration: { "@type": "QuantitativeValue", value: o.durationDays, unitCode: "DAY" } } : {}),
        })),
      ),
    ],
  };

  return (
    <PublicPage
      eyebrow="Tariflar"
      title={TITLE}
      lead="Standart — testlar bilan mustaqil tayyorgarlik. Premium va Mentor — videodarslar, shaxsiy kurator va ustoz bilan, haydovchilik imtihonidan oʻtguningizcha."
      jsonLd={jsonLd}
    >
      <div className="flex items-start gap-3 rounded-2xl border border-neon-orange/40 bg-neon-orange/10 p-4 text-sm text-foreground" data-testid="trial-note">
        <GiftIcon className="mt-0.5 size-5 shrink-0 text-neon-orange" />
        <p>
          <b>{TARIFF_RULES.trialDays} kunlik bepul sinov.</b> Roʻyxatdan oʻtgach, platformani bepul sinab koʻrasiz va keyin tarifni tanlaysiz.
        </p>
      </div>

      <div className="mt-8">
        <TariffCards />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Rule icon={UserCheckIcon} title={`${BUSINESS.minAge} yoshdan katta`}>
          Xizmat {BUSINESS.minAge} yoshdan katta foydalanuvchilar uchun moʻljallangan.
        </Rule>
        <Rule icon={MonitorSmartphoneIcon} title={`1 akkaunt — ${TARIFF_RULES.maxDevices} qurilma`}>
          Bitta akkauntdan faqat {TARIFF_RULES.maxDevices} ta qurilmada foydalaniladi. Akkauntni boshqalarga berish mumkin emas.
        </Rule>
        <Rule icon={ShieldCheckIcon} title="Xavfsiz toʻlov">
          Toʻlov Payme va Click (keyinroq Uzum Bank) orqali amalga oshiriladi. Karta maʼlumotlari saytda saqlanmaydi.
        </Rule>
      </div>

      <div className="mt-10 glass rounded-2xl p-5 sm:p-8">
        <DocSection title="Obuna tugagach nima boʻladi?">
          <ul>
            <li>
              <b>Standart:</b> muddat tugagach natijalaringiz saqlanib qoladi va ularni faqat koʻrish mumkin; yangi test va imtihon topshirish yopiladi. Davom ettirish uchun
              obunani yangilang.
            </li>
            <li>
              <b>Premium va Mentor:</b> xizmat haydovchilik imtihonidan oʻtguningizcha koʻrsatiladi. Imtihondan oʻtganingizdan keyin administrator akkauntni yopadi.
            </li>
          </ul>
        </DocSection>
        <DocSection title="Toʻlov va qaytarish">
          <p>
            Toʻlov qilish orqali siz <Link href="/oferta">ommaviy oferta</Link> shartlarini qabul qilasiz. Bepul sinovdan keyin amalga oshirilgan toʻlov qaytarilmaydi; texnik
            nosozlik boʻlsa, yoʻqotilgan vaqt obuna muddatiga qoʻshib beriladi. Batafsil: <Link href="/qaytarish">qaytarish siyosati</Link>.
          </p>
        </DocSection>
      </div>
    </PublicPage>
  );
}

function Rule({ icon: Icon, title, children }: { icon: typeof GiftIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5">
      <Icon className="size-5 text-neon-cyan" />
      <h3 className="mt-3 font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
