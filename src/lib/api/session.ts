// Anonim qurilma sessiyasi. Token birinchi kerak bo'lganda backend'dan olinadi
// va localStorage'da saqlanadi; barcha shaxsiy so'rovlar (saqlanganlar)
// `Authorization: Bearer` bilan yuboriladi.
//
// Markaz o'quvchisi ("Men shu yerda o'qiyman") login + parol bilan kiradi va
// bir vaqtda faqat bitta qurilmada ishlaydi: backend boshqa qurilmadan
// kirilganda eski tokenga 401 + kod qaytaradi. Bunday holda sessiya tozalanadi,
// sabab sessionStorage'ga yoziladi va bosh sahifa (qayta kirish oynasi) ochiladi.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const TOKEN_KEY = "pt_session_token";
/** Joriy sessiya markaz o'quvchisiniki — 401 da yangi anonim sessiya ochilmaydi. */
const CENTER_KEY = "pt_center";
const REGISTRATION_KEY = "pt_registration";
const KICKED_KEY = "pt_kicked";

export type KickReason = "SESSION_REPLACED" | "SESSION_REVOKED" | "ACCOUNT_INACTIVE";
const KICK_CODES: readonly string[] = ["SESSION_REPLACED", "SESSION_REVOKED", "ACCOUNT_INACTIVE"];

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`So'rov muvaffaqiyatsiz tugadi: ${status}`);
  }
}

let pending: Promise<string> | null = null;

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function createToken(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/auth/session`, { method: "POST" });
  if (!res.ok) throw new ApiError(res.status);
  const { token } = (await res.json()) as { token: string };
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Xotira yo'q (shaxsiy oyna) — token faqat shu sahifa davomida yashaydi.
  }
  return token;
}

/** Joriy token; yo'q bo'lsa bitta (parallel so'rovlar uchun umumiy) sessiya yaratiladi. */
function getToken(): Promise<string> {
  const stored = readToken();
  if (stored) return Promise.resolve(stored);
  pending ??= createToken().finally(() => {
    pending = null;
  });
  return pending;
}

/** Chiqishda — keyingi foydalanuvchi oldingisining saqlanganlarini ko'rmasligi uchun. */
export function clearSessionToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CENTER_KEY);
  } catch {
    // ignore
  }
}

export function hasSessionToken(): boolean {
  return readToken() !== null;
}

/** Markaz o'quvchisi sifatida kirilganmi (sessiya tekshiruvi shu holatda ishlaydi). */
export function isCenterSession(): boolean {
  try {
    return localStorage.getItem(CENTER_KEY) === "1" && readToken() !== null;
  } catch {
    return false;
  }
}

/** Markaz kirishidan keyin — yangi token shu qurilmaning yagona sessiyasi. */
export function setCenterSessionToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(CENTER_KEY, "1");
  } catch {
    // Xotira yo'q (shaxsiy oyna) — token faqat shu sahifa davomida yashaydi.
  }
}

/** Bosh sahifa uchun: nega chiqarilgani (bir marta o'qiladi). */
export function takeKickReason(): KickReason | null {
  try {
    const reason = sessionStorage.getItem(KICKED_KEY);
    sessionStorage.removeItem(KICKED_KEY);
    return reason && KICK_CODES.includes(reason) ? (reason as KickReason) : null;
  } catch {
    return null;
  }
}

let kicking = false;

/**
 * Sessiya bekor qilingan (boshqa qurilmadan kirilgan, admin chiqargan, akkaunt
 * faolsiz): mahalliy ma'lumot tozalanadi va bosh sahifa to'liq qayta yuklanadi
 * (xotiradagi do'konlar ham bo'shaydi).
 */
function kickOut(reason: KickReason): void {
  if (typeof window === "undefined" || kicking) return;
  kicking = true;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CENTER_KEY);
    localStorage.removeItem(REGISTRATION_KEY);
    sessionStorage.setItem(KICKED_KEY, reason);
  } catch {
    // ignore
  }
  window.location.assign("/");
}

async function readCode(res: Response): Promise<string | undefined> {
  try {
    return ((await res.clone().json()) as { code?: string }).code;
  } catch {
    return undefined;
  }
}

/**
 * Sessiyali so'rov. Token bekor bo'lsa (401) — yangi sessiya bilan bir marta
 * qayta urinadi. 204 da `undefined` qaytadi.
 */
export async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const send = async (token: string) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
        Authorization: `Bearer ${token}`,
      },
    });

  let res = await send(await getToken());
  if (res.status === 401) {
    const code = await readCode(res);
    if (code && KICK_CODES.includes(code)) {
      kickOut(code as KickReason);
      throw new ApiError(401, code);
    }
    if (isCenterSession()) {
      // Markaz akkaunti o'chirilgan yoki sessiya muddati o'tgan — anonim sessiyaga o'tib ketmaymiz.
      kickOut("SESSION_REVOKED");
      throw new ApiError(401, code);
    }
    clearSessionToken();
    res = await send(await getToken());
  }
  if (!res.ok) {
    let code: string | undefined;
    try {
      code = ((await res.json()) as { code?: string }).code;
    } catch {
      // tana JSON emas
    }
    // To'lov tasdiqlanmagan (yoki bekor qilingan) — kurs kontenti yopiq.
    if (res.status === 403 && code === "PAYMENT_REQUIRED" && typeof window !== "undefined" && window.location.pathname !== "/tolov") {
      window.location.assign("/tolov");
    }
    throw new ApiError(res.status, code);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
