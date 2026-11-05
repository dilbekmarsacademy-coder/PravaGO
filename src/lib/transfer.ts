// Domen ko'chishi (pravatayyor.vercel.app → pravaishonch.uz) uchun umumiy qoidalar.

import { SITE_URL } from "@/lib/seo";

/** Faqat shu host ko'chish sahifasiga yo'naltiriladi (preview, localhost va yangi domen — tegilmaydi). */
export const OLD_HOST = process.env.NEXT_PUBLIC_TRANSFER_OLD_HOST || "pravatayyor.vercel.app";
/** Lokal sinov uchun almashtirsa bo'ladi; production'da — asosiy domen. */
export const NEW_SITE_URL = process.env.NEXT_PUBLIC_TRANSFER_TARGET_URL || SITE_URL;
export const MOVED_PATH = "/ko-chdi";
export const TRANSFER_PATH = "/auth/transfer";
const DEFAULT_NEXT = "/kabinet";

/**
 * Ichki yo'l: "/" bilan boshlanadi, "//" yoki "/\" emas, boshqa hostga olib
 * chiqmaydi (open redirect yo'q). Aks holda — /kabinet.
 */
export function safeNextPath(value: string | null | undefined, fallback = DEFAULT_NEXT): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://internal.invalid");
    if (url.origin !== "https://internal.invalid") return fallback;
    const path = `${url.pathname}${url.search}${url.hash}`;
    // Ko'chish/transfer sahifalarining o'ziga qaytish — aylanma bo'lmasin.
    if (url.pathname === MOVED_PATH || url.pathname === TRANSFER_PATH) return fallback;
    return path;
  } catch {
    return fallback;
  }
}

/** Kirmagan foydalanuvchi (yoki xato): yangi domendagi o'sha sahifa, kodsiz. */
export function plainTarget(oldPath: string): string {
  return `${NEW_SITE_URL}${safeNextPath(oldPath, "/")}`;
}

/** Kirgan foydalanuvchi: yangi domen transfer sahifasi (kod faqat query'da, bir martalik). */
export function transferTarget(code: string, oldPath: string): string {
  const next = safeNextPath(oldPath === "/" ? DEFAULT_NEXT : oldPath);
  const params = new URLSearchParams({ code, next });
  return `${NEW_SITE_URL}${TRANSFER_PATH}?${params.toString()}`;
}
