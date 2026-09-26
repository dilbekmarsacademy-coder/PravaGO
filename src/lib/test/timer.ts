// Test taymeri uchun sof funksiyalar (React'ga bog'liq emas).

export type TimeUrgency = "normal" | "warning" | "critical";

/** Qolgan vaqtning shu ulushidan kam qolsa — ogohlantirish (sariq). */
const WARNING_RATIO = 0.3;
/** Shu soniyadan (yoki vaqtning 10% idan) kam qolsa — xavf (qizil). */
const CRITICAL_SEC = 10;
const CRITICAL_RATIO = 0.1;

export function getTimeUrgency(remainingSec: number, limitSec: number): TimeUrgency {
  const criticalAt = Math.max(CRITICAL_SEC, limitSec * CRITICAL_RATIO);
  if (remainingSec <= criticalAt) return "critical";
  if (remainingSec <= limitSec * WARNING_RATIO) return "warning";
  return "normal";
}

/** Soniyalarni "MM : SS" ko'rinishida chiqaradi. */
export function formatClock(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")} : ${String(seconds).padStart(2, "0")}`;
}
