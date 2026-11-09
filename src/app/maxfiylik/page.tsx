import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS, EMAIL_HREF, TELEGRAM_HANDLE } from "@/config/business";
import { getRequisites } from "@/config/requisites.server";
import { organizationLd } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/seo";
import { DocCard, DocSection, PublicPage } from "@/components/legal/PublicPage";

// TODO(yurist): maxfiylik siyosatini yurist ko'rib chiqishi kerak.

const TITLE = "Maxfiylik siyosati";
const DESCRIPTION = "PravaIshonch maxfiylik siyosati: qanday shaxsiy maʼlumotlar yigʻiladi, nima uchun ishlatiladi, qancha saqlanadi va foydalanuvchi huquqlari.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/maxfiylik" },
  openGraph: { title: `${TITLE} — PravaIshonch`, description: DESCRIPTION, url: `${SITE_URL}/maxfiylik` },
};

export default function PrivacyPage() {
  const requisites = getRequisites();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationLd(requisites),
      { "@type": "WebPage", name: TITLE, url: `${SITE_URL}/maxfiylik`, inLanguage: "uz", about: { "@id": `${SITE_URL}/#organization` } },
    ],
  };
  return (
    <PublicPage
      eyebrow="Hujjatlar"
      title={TITLE}
      lead="Biz faqat xizmat koʻrsatish uchun zarur boʻlgan maʼlumotlarni yigʻamiz va ularni sotmaymiz."
      updated="2026-yil 9-noyabr"
      jsonLd={jsonLd}
    >
      <DocCard>
        <DocSection title="1. Maʼlumotlar egasi">
          <p>
            Shaxsiy maʼlumotlarni qayta ishlovchi: {requisites.sellerName} (“{BUSINESS.brandName}”), manzil: {requisites.address}.
          </p>
        </DocSection>
        <DocSection title="2. Qanday maʼlumotlar yigʻiladi">
          <ul>
            <li>Ism, familiya va yosh (roʻyxatdan oʻtishda kiritiladi);</li>
            <li>telefon raqam;</li>
            <li>test natijalari, video darslar va imtihonlar boʻyicha jarayon;</li>
            <li>IP manzil boʻyicha taxminiy hudud (viloyat) — aniq manzil aniqlanmaydi;</li>
            <li>qurilma sessiyasi identifikatori (bitta akkaunt — bitta qurilma qoidasi uchun) va saytdan foydalanish statistikasi (tashqi analitika xizmatlarisiz).</li>
          </ul>
          <p>
            <b>Bank kartasi maʼlumotlari saytda kiritilmaydi va saqlanmaydi.</b> Toʻlov Payme, Click (keyinroq Uzum Bank) sahifasida amalga oshiriladi; biz faqat toʻlov
            holati va summasini olamiz.
          </p>
        </DocSection>
        <DocSection title="3. Maʼlumotlar nima uchun ishlatiladi">
          <ul>
            <li>akkaunt yaratish, kirish va xizmatga ruxsat berish;</li>
            <li>oʻqish jarayoni va natijalarni koʻrsatish, sertifikat berish;</li>
            <li>toʻlovlarni tasdiqlash va murojaatlarga javob berish;</li>
            <li>akkauntdan boshqalar foydalanishining oldini olish;</li>
            <li>xizmat sifatini yaxshilash (umumlashtirilgan statistika).</li>
          </ul>
        </DocSection>
        <DocSection title="4. Uchinchi tomonlarga berish">
          <p>
            Maʼlumotlar sotilmaydi va reklama uchun berilmaydi. Faqat xizmat uchun zarur hollarda uzatiladi: toʻlov tizimlariga (Payme, Click, Uzum Bank) — toʻlovni amalga
            oshirish uchun; SMS xizmati provayderiga — tasdiqlash kodini yuborish uchun; hosting va maʼlumotlar bazasi provayderlariga — saytning ishlashi uchun; qonunda
            belgilangan hollarda vakolatli davlat organlariga.
          </p>
        </DocSection>
        <DocSection title="5. Saqlash muddati">
          <p>
            Maʼlumotlar akkaunt faol boʻlgan davrda saqlanadi. Akkauntni oʻchirish soʻrovi kelganda maʼlumotlar 30 kun ichida oʻchiriladi, qonunchilik boʻyicha saqlanishi
            shart boʻlgan toʻlov yozuvlari bundan mustasno.
          </p>
        </DocSection>
        <DocSection title="6. Foydalanuvchi huquqlari">
          <ul>
            <li>oʻzingiz haqingizdagi maʼlumotlarni bilish va nusxasini soʻrash;</li>
            <li>notoʻgʻri maʼlumotlarni tuzattirish;</li>
            <li>akkaunt va maʼlumotlarni oʻchirishni talab qilish;</li>
            <li>maʼlumotlarni qayta ishlashga rozilikni qaytarib olish (bunda xizmatdan foydalanish toʻxtaydi).</li>
          </ul>
        </DocSection>
        <DocSection title="7. Xavfsizlik">
          <p>
            Maʼlumotlar himoyalangan (HTTPS) ulanish orqali uzatiladi, ularga kirish faqat vakolatli xodimlarga ruxsat etiladi. Brauzerda faqat sessiya, til va mavzu
            sozlamalari saqlanadi.
          </p>
        </DocSection>
        <DocSection title="8. Bogʻlanish">
          <p>
            Maʼlumotlar boʻyicha soʻrovlar: Telegram{" "}
            <a href={BUSINESS.telegram} target="_blank" rel="noopener noreferrer">
              {TELEGRAM_HANDLE}
            </a>
            , email <a href={EMAIL_HREF}>{BUSINESS.email}</a>. Boshqa aloqa usullari — <Link href="/aloqa">aloqa sahifasida</Link>. Ushbu siyosat{" "}
            <Link href="/oferta">ommaviy oferta</Link>ning ajralmas qismi hisoblanadi.
          </p>
        </DocSection>
      </DocCard>
    </PublicPage>
  );
}
