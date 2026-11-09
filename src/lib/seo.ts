import { BUSINESS, INSTAGRAM_URL } from "@/config/business";

// SEO uchun yagona manba: asosiy domen va brend nomlari. Canonical, sitemap,
// robots va JSON-LD shu yerdan oladi — *.vercel.app manzillari indekslanmaydi.

export const SITE_URL = "https://www.pravaishonch.uz";
export const BRAND_NAME = "PravaIshonch";
/** Qidiruvda bo'shliq bilan va domen ko'rinishida ham tanilsin. */
export const BRAND_ALT_NAMES = ["Prava Ishonch", "Prava Ishonch uz", "PravaIshonch.uz"];
export const SITE_TITLE = "PravaIshonch (Prava Ishonch) — haydovchilik imtihoniga onlayn tayyorgarlik";
export const SITE_DESCRIPTION =
  "PravaIshonch (Prava Ishonch) — haydovchilik guvohnomasi (prava) imtihoniga onlayn tayyorgarlik: video darslar, kalit soʻzlar va YHXBB imtihon savollari asosidagi testlar. 7 kunda imtihonga tayyorlaning.";
export const SITE_KEYWORDS = [
  "prava ishonch",
  "pravaishonch",
  "PravaIshonch",
  "prava imtihoni",
  "haydovchilik guvohnomasi testlari",
  "prava test",
  "avtotest",
];
/** Brend ranglari (manifest, brauzer paneli): to'q fon va oltin aksent. */
export const BRAND_DARK = "#050811";
/** Ulashish rasmi (Open Graph / Twitter) — public/og-image.png, 1200×630. */
export const OG_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: "PravaIshonch (Prava Ishonch) — haydovchilik imtihoniga onlayn tayyorgarlik" };

/** Ijtimoiy tarmoq havolalari — Organization.sameAs (manba: src/config/business.ts). */
export const SOCIAL_LINKS: string[] = [BUSINESS.telegram, INSTAGRAM_URL, BUSINESS.youtube];
