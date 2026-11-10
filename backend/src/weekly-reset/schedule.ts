// Haftalik yangilanish jadvali — sof funksiyalar (testlanadi). Vaqt zonasi
// Asia/Tashkent: doimiy UTC+5, yozgi vaqt yo'q. Yangilanish — har dushanba
// 22:00, ogohlantirish lentasi — o'sha kuni 12:00 dan.

const TZ_OFFSET_MS = 5 * 3600_000;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const RESET_HOUR = 22;
const BANNER_HOUR = 12;

/** Toshkent vaqtidagi "devor soati" (UTC getter'lari bilan o'qiladi). */
function wall(date: Date): Date {
  return new Date(date.getTime() + TZ_OFFSET_MS);
}

/** Toshkent devor soatini haqiqiy vaqtga qaytaradi. */
function fromWall(wallMs: number): Date {
  return new Date(wallMs - TZ_OFFSET_MS);
}

/** `now` dan oldingi (yoki aynan shu) eng yaqin dushanba 22:00 (Toshkent). */
export function lastResetBoundary(now: Date): Date {
  const w = wall(now);
  const midnight = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate());
  const sinceMonday = (w.getUTCDay() + 6) % 7; // dushanba = 0
  let boundary = midnight - sinceMonday * DAY_MS + RESET_HOUR * 3600_000;
  if (boundary > w.getTime()) boundary -= WEEK_MS;
  return fromWall(boundary);
}

/** `now` dan keyingi dushanba 22:00 (Toshkent). Aynan 22:00 da — keyingi haftaniki. */
export function nextResetAt(now: Date): Date {
  return new Date(lastResetBoundary(now).getTime() + WEEK_MS);
}

/** Lenta ko'rinadigan oraliq boshi: keyingi yangilanish kuni 12:00. */
export function bannerFrom(now: Date): Date {
  return new Date(nextResetAt(now).getTime() - (RESET_HOUR - BANNER_HOUR) * 3600_000);
}

/**
 * Lenta: dushanba 12:00 dan 22:00 gacha; 22:00 dan keyin esa yangilanish
 * hali bajarilayotgan bo'lsa — tugaguncha (ko'pi bilan 2 soat).
 */
export function isBannerVisible(now: Date, resetRunning: boolean): boolean {
  if (now.getTime() >= bannerFrom(now).getTime()) return true;
  return resetRunning && now.getTime() - lastResetBoundary(now).getTime() < 2 * 3600_000;
}

/** ISO hafta kaliti, masalan "2026-W46" — yangilanish dushanbasi (Toshkent sanasi) bo'yicha. */
export function weekKeyOf(boundary: Date): string {
  const w = wall(boundary);
  const date = new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()));
  // ISO: hafta payshanbasi qaysi yilda bo'lsa — shu yil.
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const year = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / DAY_MS - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export const INITIAL_WEEK_KEY = "initial-launch";

export function manualWeekKey(now: Date): string {
  return `manual-${now.toISOString().slice(0, 19)}`;
}
