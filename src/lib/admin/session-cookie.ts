// Admin sessiya cookie'si (faqat serverda: proxy.ts va /admin/api route).
// Qiymat: `<token>.<muddat ms>.<HMAC>` — imzo ADMIN_SESSION_SECRET bilan.
// proxy.ts shu imzoni tekshiradi; tokenning haqiqiyligi (bekor qilinmagani)
// esa har bir API so'rovida backend'da tekshiriladi.

import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "__Host-pt_admin";
export const ADMIN_CSRF_COOKIE = "__Host-pt_admin_csrf";
export const ADMIN_CSRF_HEADER = "x-csrf-token";
export const ADMIN_SESSION_TTL_SEC = 12 * 60 * 60;

export function adminSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function sealAdminCookie(secret: string, token: string, expiresAtMs: number): string {
  const payload = `${token}.${expiresAtMs}`;
  return `${payload}.${sign(secret, payload)}`;
}

/** Imzo va muddat to'g'ri bo'lsa — backend tokeni, aks holda null. */
export function openAdminCookie(secret: string, value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [token, exp, sig] = parts;
  if (!safeEqual(sig, sign(secret, `${token}.${exp}`))) return null;
  const expiresAt = Number(exp);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return token;
}

/** Backend'ga yuboriladigan proxy kaliti (backend/src/admin/admin-config.ts bilan bir xil). */
export function adminProxyKey(secret: string): string {
  return createHmac("sha256", secret).update("admin-proxy-v1").digest("hex");
}

export { safeEqual };
