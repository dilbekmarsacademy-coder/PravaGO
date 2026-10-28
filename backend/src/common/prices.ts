// Kurs narxi toifa bo'yicha (so'm) — frontend'dagi src/config/prices.ts bilan bir xil.
// To'lov so'rovidagi summa klientdan olinmaydi, shu yerdan hisoblanadi.

export const EXAM_STATUSES = ["first-time", "failed-before", "license-revoked"] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

export const COURSE_PRICES: Record<ExamStatus, number> = {
  "failed-before": 400_000,
  "first-time": 350_000,
  "license-revoked": 450_000,
};

export function coursePrice(examStatus: string | null | undefined): number {
  return COURSE_PRICES[examStatus as ExamStatus] ?? COURSE_PRICES["first-time"];
}
