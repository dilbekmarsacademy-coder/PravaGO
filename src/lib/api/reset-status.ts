// Haftalik natijalar yangilanishi holati (GET /meta/reset-status). Vaqt — server
// soati (Asia/Tashkent); mijoz soati ishlatilmaydi. Sessiya yaratmaydi: token
// bo'lmasa so'rov yuborilmaydi.

import { currentSessionToken } from "./session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface ResetStatus {
  serverNow: string;
  nextResetAt: string;
  bannerFrom: string;
  bannerVisible: boolean;
  /** Shu foydalanuvchiga tegishli oxirgi yangilanish vaqti; o'zgarsa — sahifa yangilanadi. */
  lastResetAt: string | null;
  exempt: boolean;
}

export async function getResetStatus(): Promise<ResetStatus | null> {
  const token = currentSessionToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE_URL}/meta/reset-status`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as ResetStatus;
}
