// Haftalik yangilanish jadvali — sof funksiyalar (testlanadi). Vaqt zonasi
// Asia/Tashkent: doimiy UTC+5, yozgi vaqt yo'q.
//
// Jadvalni o'zgartirish — faqat RESET_SCHEDULE (kun, soat, lenta soati). Shu
// qiymatlarga mos ravishda yana ikki joy yangilanadi: backend/vercel.json dagi
// cron ("0 17 * * 6" = shanba 22:00 Toshkent) va pastdagi RESET_CRON (@Cron).
// 2026-11-22 gacha jadval dushanba 22:00 edi.

const TZ_OFFSET_MS = 5 * 3600_000;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export const RESET_SCHEDULE = {
  timeZone: "Asia/Tashkent",
  /** Hafta kuni: 0 — yakshanba, 1 — dushanba, … 6 — shanba. */
  weekday: 6,
  /** Yangilanish soati (Toshkent). */
  hour: 22,
  /** Ogohlantirish lentasi shu kuni shu soatdan ko'rinadi. */
  bannerHour: 12,
  /**
   * Jadval kuchga kirgan birinchi yangilanish (Toshkent devor soati). Undan oldingi
   * chegaralar uchun cron/catch-up hech narsa qilmaydi — jadval almashganda o'tib
   * ketgan kun (masalan, deploy'dan oldingi shanba) darhol "qoldirilgan" deb bajarilmasin.
   */
  firstResetLocal: "2026-11-28T22:00",
} as const;

/** @Cron ifodasi (Toshkent vaqti bilan): daqiqa soat * * hafta-kuni. */
export const RESET_CRON = `0 ${RESET_SCHEDULE.hour} * * ${RESET_SCHEDULE.weekday}`;

const WEEKDAY_NAMES_UZ = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"] as const;

/** Masalan "shanba 22:00" — xabarlar va hisobotlar uchun. */
export function scheduleLabel(): string {
  return `${WEEKDAY_NAMES_UZ[RESET_SCHEDULE.weekday]} ${String(RESET_SCHEDULE.hour).padStart(2, "0")}:00`;
}

/** Toshkent vaqtidagi "devor soati" (UTC getter'lari bilan o'qiladi). */
function wall(date: Date): Date {
  return new Date(date.getTime() + TZ_OFFSET_MS);
}

/** Toshkent devor soatini haqiqiy vaqtga qaytaradi. */
function fromWall(wallMs: number): Date {
  return new Date(wallMs - TZ_OFFSET_MS);
}

/** "YYYY-MM-DDTHH:mm" (Toshkent) → haqiqiy vaqt. */
export function fromTashkentLocal(local: string): Date {
  return fromWall(Date.parse(`${local}:00Z`));
}

/** Jadval bo'yicha birinchi yangilanish vaqti (undan oldingi chegaralar bajarilmaydi). */
export function firstScheduledReset(): Date {
  return fromTashkentLocal(RESET_SCHEDULE.firstResetLocal);
}

/** `now` dan oldingi (yoki aynan shu) eng yaqin yangilanish chegarasi (shanba 22:00, Toshkent). */
export function lastResetBoundary(now: Date): Date {
  const w = wall(now);
  const midnight = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate());
  const sinceResetDay = (w.getUTCDay() - RESET_SCHEDULE.weekday + 7) % 7;
  let boundary = midnight - sinceResetDay * DAY_MS + RESET_SCHEDULE.hour * 3600_000;
  if (boundary > w.getTime()) boundary -= WEEK_MS;
  return fromWall(boundary);
}

/** `now` dan keyingi yangilanish. Aynan 22:00 da — keyingi haftaniki. */
export function nextResetAt(now: Date): Date {
  return new Date(lastResetBoundary(now).getTime() + WEEK_MS);
}

/** Lenta ko'rinadigan oraliq boshi: keyingi yangilanish kuni 12:00. */
export function bannerFrom(now: Date): Date {
  return new Date(nextResetAt(now).getTime() - (RESET_SCHEDULE.hour - RESET_SCHEDULE.bannerHour) * 3600_000);
}

/** Chegara jadval kuchga kirgandan keyinmi (undan oldingilari bajarilmaydi). */
export function isScheduledBoundary(boundary: Date): boolean {
  return boundary.getTime() >= firstScheduledReset().getTime();
}

/**
 * Lenta: yangilanish kuni 12:00 dan 22:00 gacha; 22:00 dan keyin esa yangilanish
 * hali bajarilayotgan bo'lsa — tugaguncha (ko'pi bilan 2 soat).
 */
export function isBannerVisible(now: Date, resetRunning: boolean): boolean {
  if (now.getTime() >= bannerFrom(now).getTime()) return true;
  return resetRunning && now.getTime() - lastResetBoundary(now).getTime() < 2 * 3600_000;
}

/**
 * Hafta kaliti — yangilanish sanasi (Toshkent) bo'yicha, masalan "week-2026-11-28".
 * Eski (dushanba) jadvalning ISO kalitlari ("2026-W47") bilan to'qnashmaydi —
 * aks holda shu ISO haftada dushanba bajarilgan bo'lsa, shanba o'tkazib yuborilardi.
 */
export function weekKeyOf(boundary: Date): string {
  return `week-${wall(boundary).toISOString().slice(0, 10)}`;
}

export const INITIAL_WEEK_KEY = "initial-launch";

export function manualWeekKey(now: Date): string {
  return `manual-${now.toISOString().slice(0, 19)}`;
}

/**
 * Bir martalik to'liq nollash kaliti. Idempotentlik shu kalit bilan: "done"
 * bo'lsa qayta chaqiruv hech narsa qilmaydi. Keyingi to'liq nollash kerak bo'lsa —
 * CLI'da `--key full-YYYY-MM-DD` bering (yoki shu qiymatni almashtiring).
 */
export const FULL_RESET_KEY = "full-2026-11-22";
