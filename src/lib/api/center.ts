// "Men shu yerda o'qiyman": o'quv markaz o'quvchisi telefon + login + parol
// bilan kiradi. Muvaffaqiyatli bo'lsa, token shu qurilmaning yagona sessiyasi.

import { ApiError, authFetch, setCenterSessionToken } from "./session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function centerLogin(input: { phone: string; login: string; password: string }): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/center/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let code: string | undefined;
    try {
      code = ((await res.json()) as { code?: string }).code;
    } catch {
      // tana JSON emas
    }
    throw new ApiError(res.status, code);
  }
  const { token } = (await res.json()) as { token: string };
  setCenterSessionToken(token);
}

/** Yengil "sessiya hali amalda" tekshiruvi — bekor bo'lsa authFetch o'zi chiqaradi. */
export function checkSession(): Promise<void> {
  return authFetch<void>("/auth/check");
}

/** Chiqish: backend'dagi shu qurilma sessiyasi ham o'chiriladi (xato bo'lsa ham davom etiladi). */
export function logoutSession(): Promise<void> {
  return authFetch<void>("/auth/logout", { method: "POST" }).catch(() => undefined);
}
