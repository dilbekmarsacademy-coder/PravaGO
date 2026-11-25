import type { Tariff } from "@prisma/client";

// Onlayn tariflar — narxning yagona manbai. Klientdan narx qabul qilinmaydi.
// Saytdagi ko'rinish (src/config/tariffs.ts) bilan mosligi frontend testida tekshiriladi.

export const TARIFF_IDS = ["STANDART_7", "STANDART_14", "STANDART_30", "PREMIUM", "MENTOR"] as const satisfies readonly Tariff[];

export interface OnlineTariff {
  /** so'm */
  price: number;
  /** null — muddatsiz (imtihondan o'tguncha). */
  durationDays: number | null;
}

export const ONLINE_TARIFFS: Record<Tariff, OnlineTariff> = {
  STANDART_7: { price: 25_000, durationDays: 7 },
  STANDART_14: { price: 48_000, durationDays: 14 },
  STANDART_30: { price: 75_000, durationDays: 30 },
  PREMIUM: { price: 300_000, durationDays: null },
  MENTOR: { price: 500_000, durationDays: null },
};

/** Daraja: yuqorisi pasaytirilmaydi. Standart (1) — faqat testlar; Premium va Mentor — videodarslar ham. */
export function tariffRank(t: Tariff): number {
  return t === "MENTOR" ? 3 : t === "PREMIUM" ? 2 : 1;
}

/** Admin qo'lda tasdiqlagan to'lov muddatsiz to'liq kirish beradi — /tolov so'rovi Premium narxida. */
export const MANUAL_REQUEST_PRICE = ONLINE_TARIFFS.PREMIUM.price;

/** so'm → tiyin */
export function toTiyin(som: number): number {
  return som * 100;
}

/** Foydalanuvchiga bu tarif nimadir qo'shadimi (muddatsiz kirishi borga Standart yoki o'sha tarif qayta sotilmaydi). */
export function addsAccess(user: { paymentStatus: string; subscriptionUnlimited: boolean; subscriptionTariff: Tariff | null }, tariff: Tariff): boolean {
  const owned = Math.max(user.paymentStatus === "PAID" ? 2 : 0, user.subscriptionUnlimited && user.subscriptionTariff ? tariffRank(user.subscriptionTariff) : 0);
  return owned < 2 || tariffRank(tariff) > owned;
}
