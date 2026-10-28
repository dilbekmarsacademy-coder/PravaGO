// Admin panel sozlamalari — faqat muhit o'zgaruvchilaridan, so'rov vaqtida
// o'qiladi (serverless'da modul yuklanishidan oldin env tayyor bo'lmasligi mumkin).

import { createHmac, timingSafeEqual } from "crypto";

/** Admin sessiyasi muddati — 12 soat. */
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Kirish rate limit: oynada shuncha muvaffaqiyatsiz urinishdan keyin bloklanadi (IP va login bo'yicha alohida). */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const MIN_PASSWORD_LENGTH = 12;

export function adminSessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

/**
 * Next.js proxy'si backend'ga yuboradigan kalit. Brauzer uni bilmaydi —
 * shuning uchun admin API'ni faqat frontend serveri orqali chaqirish mumkin.
 */
export function adminProxyKey(secret: string): string {
  return createHmac("sha256", secret).update("admin-proxy-v1").digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * `ADMIN_ACCESS_CODE_HASH` — argon2id xeshi. `$` belgilari env fayllarda
 * buzilmasligi uchun base64 ko'rinishida ham saqlash mumkin.
 */
export function accessCodeHash(): string | null {
  const raw = process.env.ADMIN_ACCESS_CODE_HASH?.trim();
  if (!raw) return null;
  if (raw.startsWith("$argon2")) return raw;
  const decoded = Buffer.from(raw, "base64").toString("utf8");
  return decoded.startsWith("$argon2") ? decoded : null;
}
