// Domen ko'chishi: eski manzilda bir martalik kod olinadi, yangi manzilda u
// sessiyaga almashtiriladi. Token/parol URL'ga hech qachon qo'yilmaydi.
// authFetch ishlatilmaydi: 401 da yangi anonim sessiya ochib, BOSHQA
// foydalanuvchi uchun kod olib qo'ymasligi kerak.

import { ApiError, currentSessionToken } from "./session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Joriy sessiya uchun 60 soniyalik kod; sessiya yo'q yoki xato bo'lsa — null. */
export async function requestTransferCode(): Promise<string | null> {
  const token = currentSessionToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/transfer-code`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      referrerPolicy: "no-referrer",
    });
    if (!res.ok) return null;
    return ((await res.json()) as { code: string }).code;
  } catch {
    return null;
  }
}

export async function exchangeTransferCode(code: string): Promise<{ token: string; center: boolean }> {
  const res = await fetch(`${API_BASE_URL}/auth/transfer-exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
    referrerPolicy: "no-referrer",
  });
  if (!res.ok) {
    let errorCode: string | undefined;
    try {
      errorCode = ((await res.json()) as { code?: string }).code;
    } catch {
      // tana JSON emas
    }
    throw new ApiError(res.status, errorCode);
  }
  return (await res.json()) as { token: string; center: boolean };
}
