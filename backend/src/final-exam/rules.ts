// Yakuniy ichki imtihon qoidalari — sof funksiyalar.

import type { FinalExamType } from "@prisma/client";

export const FINAL_EXAM_TYPES: Record<FinalExamType, { questions: number; minutes: number }> = {
  Q20: { questions: 20, minutes: 25 },
  Q50: { questions: 50, minutes: 45 },
};

/**
 * Imtihon 1–6-kun mavzulari tugatilishini talab qiladimi. false — o'quvchi
 * to'g'ridan-to'g'ri kirib topshira oladi (kursga kirish huquqi baribir kerak).
 */
export const FINAL_EXAM_REQUIRES_COURSE = false;

/** Har bir tur uchun alohida urinishlar soni. */
export const FINAL_EXAM_MAX_ATTEMPTS = 10;
/** O'tish uchun 10 ta urinish o'rtachasi (1 xona kasr bilan) kamida shuncha bo'lishi kerak. */
export const FINAL_EXAM_PASS_AVERAGE = 98;

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Urinish natijasi: to'g'ri / jami * 100, 1 xona kasr bilan. */
export function scorePercent(correct: number, total: number): number {
  return total > 0 ? round1((correct / total) * 100) : 0;
}

/** O'rtacha (1 xona kasr). Bo'sh ro'yxat — null. */
export function averagePercent(percents: readonly number[]): number | null {
  if (percents.length === 0) return null;
  return round1(percents.reduce((s, p) => s + p, 0) / percents.length);
}

/** O'tdi: kamida 10 ta yakunlangan urinish va o'rtacha >= 98.0. */
export function isPassed(percents: readonly number[]): boolean {
  if (percents.length < FINAL_EXAM_MAX_ATTEMPTS) return false;
  const avg = averagePercent(percents.slice(0, FINAL_EXAM_MAX_ATTEMPTS));
  return avg !== null && avg >= FINAL_EXAM_PASS_AVERAGE;
}

/** "98%" yoki "98,7%" — butun bo'lsa kasrsiz, aks holda vergul bilan 1 xona. */
export function formatPercent(value: number): string {
  const v = round1(value);
  return `${Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")}%`;
}

/** PI-2026-000123 */
export function certificateNumber(year: number, serial: number): string {
  return `PI-${year}-${String(serial).padStart(6, "0")}`;
}

export const CERTIFICATE_NUMBER_RE = /^PI-\d{4}-\d{6}$/;
