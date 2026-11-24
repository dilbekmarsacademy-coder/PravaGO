// Onlayn to'lov (Payme): narxlar, buyurtma yaratish va holati. Narx faqat
// serverdan keladi; to'lov natijasi faqat buyurtma holatidan o'qiladi.

import { authFetch, currentSessionToken } from "./session";

export type OnlineTariffId = "STANDARD" | "PRO" | "MAX";
export type OrderStatus = "PENDING" | "PAID" | "CANCELLED";

export interface OnlineTariffs {
  enabled: boolean;
  /** price — so'm */
  tariffs: { id: OnlineTariffId; price: number; durationDays: number }[];
}

export interface Order {
  id: string;
  tariff: OnlineTariffId;
  /** tiyin */
  amount: number;
  status: OrderStatus;
}

/** Ommaviy: sessiya yo'q bo'lsa yangisi yaratilmaydi. */
export async function getOnlineTariffs(): Promise<OnlineTariffs> {
  const token = currentSessionToken();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/payments/tariffs`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  if (!res.ok) throw new Error(`tariffs: ${res.status}`);
  return (await res.json()) as OnlineTariffs;
}

export function createOrder(tariff: OnlineTariffId): Promise<Order & { checkoutUrl: string }> {
  return authFetch("/payments/create-order", { method: "POST", body: JSON.stringify({ tariff }) });
}

export function getOrder(id: string): Promise<Order> {
  return authFetch(`/payments/order/${encodeURIComponent(id)}`);
}
