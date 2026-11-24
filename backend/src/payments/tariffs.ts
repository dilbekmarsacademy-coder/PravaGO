import type { Tariff } from "@prisma/client";

// Onlayn tariflar — narxning yagona manbai. Klientdan narx qabul qilinmaydi.

export const TARIFF_IDS = ["STANDARD", "PRO", "MAX"] as const satisfies readonly Tariff[];

export interface OnlineTariff {
  /** so'm */
  price: number;
  durationDays: number;
}

export const ONLINE_TARIFFS: Record<Tariff, OnlineTariff> = {
  STANDARD: { price: 300_000, durationDays: 14 },
  PRO: { price: 900_000, durationDays: 30 },
  MAX: { price: 1_500_000, durationDays: 30 },
};

/** so'm → tiyin */
export function toTiyin(som: number): number {
  return som * 100;
}
