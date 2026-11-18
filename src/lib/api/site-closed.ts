// Admin saytni shu foydalanuvchi uchun yopgan: backend sessiyali har bir
// so'rovga (va login'ga) 403 + `SITE_CLOSED` qaytaradi. Bu yerda faqat xabar
// tarqatiladi — butun ekranni egallagan sahifani `SiteClosedGate` ko'rsatadi.
// Token o'chirilmaydi: admin ochganda foydalanuvchi o'sha qurilmada davom etadi
// (o'chirilsa sayt yangi anonim sessiya ochib, yopishni chetlab o'tardi).

export const SITE_CLOSED = "SITE_CLOSED";
export const SITE_CLOSED_EVENT = "pt:site-closed";

let closed = false;

export function isSiteClosed(): boolean {
  return closed;
}

export function notifySiteClosed(): void {
  if (typeof window === "undefined") return;
  closed = true;
  window.dispatchEvent(new Event(SITE_CLOSED_EVENT));
}

/** Admin ochgan — qayta tekshiruvdan keyin. */
export function clearSiteClosed(): void {
  closed = false;
}

/** fetch javobi SITE_CLOSED bo'lsa — xabar beradi va true qaytaradi (tanani o'qimaydi, nusxasini o'qiydi). */
export async function detectSiteClosed(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  try {
    const body = (await res.clone().json()) as { code?: unknown };
    if (body.code !== SITE_CLOSED) return false;
  } catch {
    return false;
  }
  notifySiteClosed();
  return true;
}
