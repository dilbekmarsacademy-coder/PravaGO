// Video darslar API qatlami. Video manbai frontend kodida yo'q — u faqat
// sessiya bilan `getLessonVideo()` orqali olinadi. Progress va "ko'rildi"
// holati serverda hisoblanadi; klient faqat xom o'lchovlarni yuboradi.

import { authFetch } from "./session";

export interface LessonStatus {
  lessonId: string;
  topicSlug: string;
  durationSec: number;
  /** Davom ettirish nuqtasi (soniya). */
  position: number;
  /** Eng uzoq ko'rilgan nuqta — oldinga faqat shu yergacha o'tish mumkin. */
  maxPosition: number;
  watchedSeconds: number;
  watchedPercent: number;
  completed: boolean;
}

export interface ProgressReport {
  position: number;
  maxPosition: number;
  /** Oxirgi tasdiqlangan hisobotdan beri ko'rilgan soniyalar. */
  watchedDelta: number;
}

/** Test savollari endpointi dars ko'rilmaguncha shu kod bilan 403 qaytaradi. */
export const LESSON_LOCKED_CODE = "LESSON_NOT_COMPLETED";
/** Darsga hali video ulanmagan (serverdagi xaritada yo'q) — 404. */
export const LESSON_NOT_FOUND_CODE = "LESSON_NOT_FOUND";

/** Video ulangan barcha darslar holati (kabinetdagi foizlar uchun). */
export function listLessonStatuses(): Promise<LessonStatus[]> {
  return authFetch<LessonStatus[]>("/lessons");
}

export function getLessonStatus(lessonId: string): Promise<LessonStatus> {
  return authFetch<LessonStatus>(`/lessons/${encodeURIComponent(lessonId)}`);
}

export function getLessonVideo(lessonId: string): Promise<{ videoId: string }> {
  return authFetch<{ videoId: string }>(`/lessons/${encodeURIComponent(lessonId)}/video`);
}

/** `keepalive` — sahifa yopilayotganda ham so'rov yetib boradi. */
export function reportLessonProgress(
  lessonId: string,
  report: ProgressReport,
  options?: { keepalive?: boolean },
): Promise<LessonStatus> {
  return authFetch<LessonStatus>(`/lessons/${encodeURIComponent(lessonId)}/progress`, {
    method: "POST",
    body: JSON.stringify(report),
    keepalive: options?.keepalive,
  });
}
