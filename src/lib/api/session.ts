// Anonim qurilma sessiyasi. Token birinchi kerak bo'lganda backend'dan olinadi
// va localStorage'da saqlanadi; barcha shaxsiy so'rovlar (saqlanganlar)
// `Authorization: Bearer` bilan yuboriladi. Real login qo'shilganda faqat shu
// fayl o'zgaradi.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const TOKEN_KEY = "pt_session_token";

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
  } catch {
    // ignore
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
    throw new ApiError(res.status, code);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
