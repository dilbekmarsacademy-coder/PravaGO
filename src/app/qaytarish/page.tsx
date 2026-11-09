import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS, TELEGRAM_HANDLE } from "@/config/business";
import { getRequisites } from "@/config/requisites.server";
import { TARIFF_RULES } from "@/config/tariffs";
import { organizationLd } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/seo";
import { DocCard, DocSection, PublicPage } from "@/components/legal/PublicPage";

const TITLE = "Qaytarish siyosati";
const DESCRIPTION = `PravaIshonch toʻlovlarni qaytarish siyosati: ${TARIFF_RULES.trialDays} kunlik bepul sinov, texnik nosozlikda muddatni uzaytirish va shikoyat berish tartibi.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/qaytarish" },
  openGraph: { title: `${TITLE} — PravaIshonch`, description: DESCRIPTION, url: `${SITE_URL}/qaytarish` },
};

export default function RefundPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationLd(getRequisites()),
      { "@type": "WebPage", name: TITLE, url: `${SITE_URL}/qaytarish`, inLanguage: "uz", about: { "@id": `${SITE_URL}/#organization` } },
    ],
  };
  return (
    <PublicPage eyebrow="Hujjatlar" title={TITLE} lead="Toʻlovdan oldin xizmatni bepul sinab koʻrishingiz mumkin. Quyida toʻlov va qaytarish qoidalari." updated="2026-yil 9-noyabr" jsonLd={jsonLd}>
      <DocCard>
        <DocSection title={`1. ${TARIFF_RULES.trialDays} kunlik bepul sinov`}>
          <p>
            Roʻyxatdan oʻtgan har bir foydalanuvchi platformani {TARIFF_RULES.trialDays} kun bepul sinab koʻradi. Sinov davomida darslar va testlar sizga mos kelishini
            tekshirib, keyin tarif tanlaysiz.
          </p>
        </DocSection>
        <DocSection title="2. Toʻlov qaytarilmaydi">
          <p>
            Bepul sinovdan keyin amalga oshirilgan toʻlov <b>qaytarilmaydi</b> — jumladan, bepul darsni koʻrib, maʼqul topib toʻlov qilingan holatda ham. Toʻlov qilish
            orqali siz <Link href="/oferta">ommaviy oferta</Link> shartlariga rozilik bildirasiz.
          </p>
        </DocSection>
        <DocSection title="3. Texnik nosozlik boʻlsa">
          <p>
            Agar sayt ishlamagan yoki bizning tomonimizdagi texnik sabab bilan kabinetga kirish imkoni boʻlmagan boʻlsa, <b>yoʻqotilgan vaqt obuna muddatiga qoʻshib beriladi</b>.
            Buning uchun muammo vaqtini va qisqacha tavsifini yozib murojaat qiling.
          </p>
        </DocSection>
        <DocSection title="4. Shikoyat va murojaat">
          <ul>
            <li>
              Telegram:{" "}
              <a href={BUSINESS.telegram} target="_blank" rel="noopener noreferrer">
                {TELEGRAM_HANDLE}
              </a>
            </li>
            <li>Ish vaqti: har kuni {BUSINESS.workingHours}</li>
            <li>Murojaatga 3 ish kuni ichida javob beriladi.</li>
          </ul>
          <p>
            Boshqa aloqa usullari: <Link href="/aloqa">aloqa sahifasi</Link>.
          </p>
        </DocSection>
      </DocCard>
    </PublicPage>
  );
}
