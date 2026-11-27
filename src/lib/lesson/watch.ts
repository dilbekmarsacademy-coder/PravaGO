// Video ko'rish hisobi — sof funksiyalar (player komponentidan ajratilgan,
// testlanadi). Bu faqat UI va server hisobotlari uchun: "ko'rildi" holatini
// baribir server o'zi tekshiradi (backend/src/lessons/lessons.service.ts).

/**
 * Player o'lchov oralig'i (ms). Har o'lchovda oldinga sakrash ham tekshiriladi —
 * talab "kamida har 0.5 s", biz 0.25 s da tekshiramiz.
 */
export const TICK_MS = 250;
/**
 * Bitta o'lchovda vaqt shundan ko'p o'zgarsa — bu tabiiy ijro emas, sakrash
 * (seek). 250 ms × 2x = 0.5 s; brauzer sekinlashgan holatlar uchun zaxira bilan.
 */
const MAX_NATURAL_STEP_SEC = 1.5;
/** Eng uzoq nuqtadan shuncha oldinga o'tib ketsa — ruxsatsiz sakrash deb qaytariladi. */
export const FORWARD_SEEK_TOLERANCE_SEC = 2;

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export interface WatchTally {
  /** Eng uzoq ko'rilgan nuqta (soniya). */
  maxPosition: number;
  /** Serverga hali yuborilmagan ko'rilgan soniyalar. */
  pendingSeconds: number;
}

export type TickResult =
  | { kind: "ok"; tally: WatchTally }
  /** Ko'rilmagan qismga sakrash — player shu nuqtaga qaytarilishi kerak. */
  | { kind: "rewind"; to: number; tally: WatchTally };

/**
 * Bitta o'lchov: `previous` → `current` (soniya). Faqat ijro paytidagi tabiiy
 * oldinga siljish ko'rilgan vaqt sifatida hisoblanadi; sakrashlar hisoblanmaydi.
 *
 * `allowJump` (admin videolarni ochgan — erkin surish): ko'rilmagan qismga
 * sakrash qaytarilmaydi, lekin u yerda ko'rilgan vaqt eng uzoq nuqtani ham,
 * ko'rilgan soniyalarni ham oshirmaydi — "ko'rildi" faqat ketma-ket ko'rib
 * yetib kelinganda bo'ladi (test sharti saqlanadi).
 */
export function tick(tally: WatchTally, previous: number, current: number, playing: boolean, allowJump = false): TickResult {
  const frontier = tally.maxPosition + FORWARD_SEEK_TOLERANCE_SEC;
  if (current > frontier && !allowJump) {
    return { kind: "rewind", to: tally.maxPosition, tally };
  }
  const step = current - previous;
  if (!playing || step <= 0 || step > MAX_NATURAL_STEP_SEC || previous > frontier) return { kind: "ok", tally };
  return {
    kind: "ok",
    tally: {
      maxPosition: Math.max(tally.maxPosition, current),
      pendingSeconds: tally.pendingSeconds + step,
    },
  };
}

/**
 * Erkin surish (oldinga ham) ruxsatmi: faqat server mavzuni tugatilgan deb aytgan
 * bo'lsa (`topicCompleted === true`) yoki admin ochgan (`freeSeek`: unlockAll yoki videosUnlocked).
 * Holat noma'lum/yuklanmagan — cheklov saqlanadi.
 */
export function canSeekFreely(status: { topicCompleted?: boolean; completed?: boolean } | null | undefined, freeSeek = false): boolean {
  if (freeSeek) return true;
  return status?.topicCompleted === true && status.completed === true;
}

/** Foydalanuvchi so'ragan seek nuqtasi — eng uzoq ko'rilgan nuqtadan oshmaydi. */
export function clampSeek(target: number, maxPosition: number, duration: number): number {
  return Math.min(Math.max(0, target), maxPosition, duration || maxPosition);
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatTime(totalSec: number): string {
  const sec = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
