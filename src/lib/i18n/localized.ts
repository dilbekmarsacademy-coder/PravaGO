// 3 tilli kontent (mavzu nomlari, keyinchalik savol/javoblar) uchun tur va
// tanlangan tilga mos matnni olish. Kontent `{ uz, cyrl, ru }` ko'rinishida
// saqlanadi; `uz` majburiy, qolganlari bo'lmasa fallback ishlaydi:
//   cyrl → `uz` dan avtomatik transliteratsiya
//   ru   → `uz`

import type { Locale } from "./dictionary";
import { formatUzLatin, latinToCyrillic } from "./translit";

export interface LocalizedText {
  uz: string;
  cyrl?: string;
  ru?: string;
}

export function localize(text: LocalizedText, locale: Locale): string {
  switch (locale) {
    case "uz-cyrl":
      return text.cyrl ?? latinToCyrillic(text.uz);
    case "ru":
      return text.ru ?? formatUzLatin(text.uz);
    default:
      return formatUzLatin(text.uz);
  }
}

/**
 * Raqamlarni minglik bo'yicha bo'sh joy bilan guruhlaydi (1 254) — o'zbek va rus
 * tillarida bir xil. Brauzerlarning ko'pchiligida o'zbek ICU ma'lumotlari yo'q
 * (Intl "1,254" qaytaradi), shuning uchun guruhlash qo'lda qilinadi.
 */
export function formatNumber(value: number, locale: Locale): string {
  void locale;
  const [integer, fraction] = String(value).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return fraction ? `${grouped},${fraction}` : grouped;
}
