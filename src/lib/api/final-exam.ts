// Yakuniy ichki imtihon (7-kun) va sertifikatlar API qatlami. Vaqt, natija,
// o'tish sharti va sertifikat — faqat serverda; klient faqat ko'rsatadi.
// To'g'ri javob imtihon tugaguncha kelmaydi (`review` — faqat tugagach).

import type { LocalizedText } from "@/lib/i18n/localized";
import { authFetch } from "./session";
import { normalizeQuestion, type ApiQuestion, type CheckAnswerResult } from "./test";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export type FinalExamType = "Q20" | "Q50";
export type FinalExamStatus = "IN_PROGRESS" | "FINISHED" | "EXPIRED";
export type ExamOutcome = "in_progress" | "passed" | "failed";

export const FINAL_EXAM_LOCKED = "FINAL_EXAM_LOCKED";
export const FINAL_EXAM_ACTIVE = "FINAL_EXAM_ACTIVE";
export const FINAL_EXAM_NO_ATTEMPTS = "FINAL_EXAM_NO_ATTEMPTS";
export const FINAL_EXAM_NOT_ENOUGH = "FINAL_EXAM_NOT_ENOUGH";
export const FINAL_EXAM_TIME_UP = "FINAL_EXAM_TIME_UP";
export const FINAL_EXAM_FINISHED = "FINAL_EXAM_FINISHED";
export const FINAL_EXAM_ALREADY_ANSWERED = "FINAL_EXAM_ALREADY_ANSWERED";

export interface AttemptSummary {
  id: string;
  type: FinalExamType;
  status: FinalExamStatus;
  startedAt: string;
  expiresAt: string;
  finishedAt: string | null;
  total: number;
  answered: number;
  correct: number | null;
  percent: number | null;
}

export interface TypeOverview {
  type: FinalExamType;
  questions: number;
  minutes: number;
  maxAttempts: number;
  attemptsUsed: number;
  attemptsLeft: number;
  average: number | null;
  attempts: AttemptSummary[];
  active: { id: string; remainingMs: number } | null;
  outcome: ExamOutcome;
  certificate: { certificateNumber: string; averagePercent: number; celebrated: boolean } | null;
  failureNote: string | null;
}

export interface FinalExamOverview {
  unlocked: boolean;
  remainingTopics: number;
  poolSize: number;
  passAverage: number;
  types: TypeOverview[];
}

export interface AttemptState extends AttemptSummary {
  remainingMs: number;
  durationSec: number;
  limitSec: number;
  attemptNo: number | null;
  archived: boolean;
  attemptsUsed: number;
  maxAttempts: number;
  average: number | null;
  finishedAttempts: number;
  outcome: ExamOutcome;
  certificateNumber: string | null;
  items: { answered: boolean; correct: boolean | null }[];
}

export interface ExamReview extends CheckAnswerResult {
  selectedOptionId: string | null;
}

export interface ExamQuestion {
  position: number;
  topicSlug: string;
  selectedOptionId: string | null;
  question: ApiQuestion;
  review: ExamReview | null;
}

export interface Certificate {
  certificateNumber: string;
  examType: FinalExamType;
  questions: number;
  averagePercent: number;
  attemptsCount: number;
  fullName: string;
  letterText: string;
  letterTone: string;
  issuedAt: string;
  celebrated: boolean;
}

export type PublicCertificate = Pick<Certificate, "certificateNumber" | "fullName" | "examType" | "questions" | "averagePercent" | "attemptsCount" | "issuedAt">;

type RawReview = Omit<ExamReview, "keyword"> & { keyword: LocalizedText };

export function getFinalExamOverview(): Promise<FinalExamOverview> {
  return authFetch<FinalExamOverview>("/final-exam");
}

export function startFinalExam(type: FinalExamType): Promise<AttemptState> {
  return authFetch<AttemptState>("/final-exam", { method: "POST", body: JSON.stringify({ type }) });
}

export function getFinalAttempt(id: string): Promise<AttemptState> {
  return authFetch<AttemptState>(`/final-exam/attempts/${id}`);
}

export async function getFinalQuestions(id: string): Promise<ExamQuestion[]> {
  const rows = await authFetch<(Omit<ExamQuestion, "question" | "review"> & { question: Parameters<typeof normalizeQuestion>[0]; review: RawReview | null })[]>(
    `/final-exam/attempts/${id}/questions`,
  );
  return rows.map((r) => ({ ...r, question: normalizeQuestion(r.question), review: r.review }));
}

export function answerFinalQuestion(id: string, position: number, optionId: string): Promise<AttemptState> {
  return authFetch<AttemptState>(`/final-exam/attempts/${id}/answers`, { method: "POST", body: JSON.stringify({ position, optionId }) });
}

/** Javobsiz tashlab ketilgan savol — server variantlarni qayta aralashtiradi va saqlaydi. */
export function skipFinalQuestion(id: string, position: number): Promise<{ position: number; optionOrder: string[] }> {
  return authFetch(`/final-exam/attempts/${id}/skip`, { method: "POST", body: JSON.stringify({ position }) });
}

export function finishFinalExam(id: string): Promise<AttemptState> {
  return authFetch<AttemptState>(`/final-exam/attempts/${id}/finish`, { method: "POST" });
}

export function listCertificates(): Promise<Certificate[]> {
  return authFetch<Certificate[]>("/certificates");
}

export function getCertificate(number: string): Promise<Certificate> {
  return authFetch<Certificate>(`/certificates/${number}`);
}

export function setCertificateName(number: string, fullName: string): Promise<Certificate> {
  return authFetch<Certificate>(`/certificates/${number}/name`, { method: "POST", body: JSON.stringify({ fullName }) });
}

export function markCertificateCelebrated(number: string): Promise<{ ok: true }> {
  return authFetch(`/certificates/${number}/celebrated`, { method: "POST" });
}

/** Ommaviy tekshirish — sessiyasiz. Topilmasa null. */
export async function verifyCertificate(number: string): Promise<PublicCertificate | null> {
  const res = await fetch(`${API_BASE_URL}/public/certificates/${encodeURIComponent(number)}`, { cache: "no-store" });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<PublicCertificate>;
}

export const EXAM_TYPE_LABEL: Record<FinalExamType, string> = { Q20: "20 talik", Q50: "50 talik" };

/** "98%" yoki "98,7%" — butun bo'lsa kasrsiz, aks holda vergul bilan 1 xona (server bilan bir xil). */
export function formatPercent(value: number): string {
  const v = Math.round(value * 10) / 10;
  return `${Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")}%`;
}

/** 08.11.2026 */
export function formatCertDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
