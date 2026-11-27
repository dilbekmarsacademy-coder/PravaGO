// Payme sozlamalari — env so'rov vaqtida o'qiladi. Kalitlar logga va javobga chiqmaydi.

export function paymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED === "true";
}

/**
 * Faqat aniq "test" (sandbox) yoki "prod" (jonli). Boshqa har qanday qiymat
 * ("production", "PROD", bo'sh, xato yozilgan) — null: to'lov butunlay yopiq,
 * jimgina sandbox'ga o'tilmaydi.
 */
export function paymeEnv(): "test" | "prod" | null {
  const env = process.env.PAYME_ENV;
  return env === "test" || env === "prod" ? env : null;
}

/** Joriy muhit kaliti; muhit noto'g'ri yoki kalit o'rnatilmagan bo'lsa null (hamma so'rov -32504 oladi). */
export function paymeKey(): string | null {
  const env = paymeEnv();
  if (!env) return null;
  return (env === "prod" ? process.env.PAYME_KEY : process.env.PAYME_TEST_KEY)?.trim() || null;
}

export function paymeMerchantId(): string | null {
  return process.env.PAYME_MERCHANT_ID?.trim() || null;
}

/**
 * Shu foydalanuvchi to'lov boshlay oladimi. Production saytda sandbox rejimi
 * faqat PAYME_TEST_USERS uchun: sandbox kartalari ochiq, aks holda istalgan
 * kishi haqiqiy pulsiz obuna olardi.
 */
export function paymentsAvailableFor(userId: string | undefined): boolean {
  if (!paymentsEnabled() || !paymeEnv() || !paymeMerchantId() || !paymeKey()) return false;
  if (paymeEnv() === "prod" || process.env.VERCEL_ENV !== "production") return true;
  const allowed = (process.env.PAYME_TEST_USERS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return userId !== undefined && allowed.includes(userId);
}

const RETURN_URL = "https://www.pravaishonch.uz/kabinet/tolov-natija";

export function paymeCheckoutUrl(order: { id: string; amount: number }): string {
  const host = paymeEnv() === "prod" ? "https://checkout.paycom.uz" : "https://test.paycom.uz";
  const params = `m=${paymeMerchantId()};ac.order_id=${order.id};a=${order.amount};l=uz;c=${RETURN_URL}?order=${order.id}`;
  return `${host}/${Buffer.from(params).toString("base64")}`;
}
