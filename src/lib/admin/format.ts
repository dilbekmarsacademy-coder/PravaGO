// Admin panel uchun sana/son formatlari (o'zbek lotin).

const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "hozirgina";
  if (min < 60) return `${min} daqiqa oldin`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} kun oldin`;
  return formatDate(value);
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatSom(n: number): string {
  return `${formatNumber(n)} so'm`;
}

export function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m} daq ${s} s` : `${s} s`;
}

/** +998901234567 → +998 90 123 45 67 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

/**
 * Telefon maydoni: kiritilgan matndan +998 dan keyingi 9 ta raqam.
 * "+998 90 123…" (maska bilan), "998901234567" yoki "901234567" (joylashtirilgan) — hammasi qabul qilinadi.
 */
export function phoneInputDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998") && (/^\s*\+?\s*998/.test(raw) || digits.length > 9)) digits = digits.slice(3);
  return digits.slice(0, 9);
}

/** 9 ta raqam → "+998 90 123 45 67" (to'liq bo'lmasa ham guruhlab). */
export function formatPhoneInput(digits: string): string {
  const groups = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean);
  return groups.length ? `+998 ${groups.join(" ")}` : "+998 ";
}

/** Video davomiyligi: 478 → "7:58", 3725 → "1:02:05". */
export function formatClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "7:58", "1:02:05" yoki "478" → soniya; noto'g'ri bo'lsa null. */
export function parseDuration(value: string): number | null {
  const parts = value.trim().split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n >= 60)) return null;
  const sec = nums.reduce((acc, n) => acc * 60 + n, 0);
  return sec > 0 ? sec : null;
}
