import "server-only";
import { BUSINESS } from "./business";

// Bank rekvizitlari .env'dan (NEXT_PUBLIC_SELLER_*). Faqat serverda o'qiladi:
// klient komponentlari tayyor, tekshirilgan qiymatni props orqali oladi — xom
// qiymat JS bundle'ga tushmaydi. STIR — aynan 9 ta raqam; boshqa qiymat
// (bo'sh, 14 xonali JSHSHIR va h.k.) saytda ko'rsatilmaydi va hech qayerga
// (HTML, log, JSON-LD) chiqarilmaydi.

export interface Requisites {
  sellerName: string;
  /** Faqat to'g'ri (9 xonali) STIR, aks holda null. */
  stir: string | null;
  bankName: string;
  mfo: string | null;
  bankAccount: string | null;
  address: string;
}

const clean = (value: string | undefined) => value?.replace(/\s/g, "") ?? "";

/**
 * Kalit nomi dinamik: Next `process.env.NEXT_PUBLIC_*` ni build vaqtida kodga
 * yozib qo'yadi — xom qiymat (masalan, adashib qo'yilgan JSHSHIR) hatto server
 * bundle'ga ham tushmasligi uchun qiymat faqat ishlash paytida o'qiladi.
 */
function readEnv(name: "NEXT_PUBLIC_SELLER_STIR" | "NEXT_PUBLIC_SELLER_MFO" | "NEXT_PUBLIC_SELLER_ACCOUNT"): string | undefined {
  return process.env[name];
}

/** STIR aynan 9 ta raqam bo'lsa — qiymat, aks holda null (qiymatning o'zi qaytmaydi va log qilinmaydi). */
export function validStir(raw: string | undefined): string | null {
  const value = clean(raw);
  return /^\d{9}$/.test(value) ? value : null;
}

/** Ogohlantirish matni — qiymatsiz, faqat sabab. */
export function stirProblem(raw: string | undefined): string | null {
  const value = clean(raw);
  if (validStir(value)) return null;
  if (!value) return "NEXT_PUBLIC_SELLER_STIR bo'sh — saytda STIR ko'rsatilmaydi.";
  if (/^\d{14}$/.test(value)) return "NEXT_PUBLIC_SELLER_STIR 14 xonali (JSHSHIR bo'lishi mumkin) — saytda ko'rsatilmaydi. Bu yerga faqat 9 xonali STIR yoziladi.";
  return "NEXT_PUBLIC_SELLER_STIR noto'g'ri: aynan 9 ta raqam bo'lishi kerak — saytda STIR ko'rsatilmaydi.";
}

let warned = false;

export function getRequisites(): Requisites {
  const raw = readEnv("NEXT_PUBLIC_SELLER_STIR");
  const problem = stirProblem(raw);
  if (problem && !warned) {
    warned = true;
    console.warn(`[rekvizitlar] ${problem}`);
  }
  const mfo = clean(readEnv("NEXT_PUBLIC_SELLER_MFO"));
  const account = clean(readEnv("NEXT_PUBLIC_SELLER_ACCOUNT"));
  return {
    sellerName: BUSINESS.sellerName,
    stir: validStir(raw),
    bankName: BUSINESS.bankName,
    mfo: /^\d{5}$/.test(mfo) ? mfo : null,
    bankAccount: /^\d{20}$/.test(account) ? account : null,
    address: BUSINESS.address,
  };
}
