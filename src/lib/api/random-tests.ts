// "Tasodifiy test" (random testlar) API qatlami. Savollar bo'laklab keladi;
// to'g'ri javob va kalit so'z faqat javob berilgandan keyin (`review`) keladi.
// Vaqt serverda: klient faqat `remainingMs` bo'yicha taymerni ko'rsatadi.

import type { LocalizedText } from "@/lib/i18n/localized";
import { authFetch } from "./session";
import { normalizeQuestion, type ApiQuestion, type CheckAnswerResult } from "./test";

export const RANDOM_TEST_SIZES = [20, 50, 100, 200] as const;
/** Bitta so'rovdagi savollar (backend MAX_CHUNK bilan bir xil). */
export const RANDOM_CHUNK = 25;

export type RandomTestStatus = "in_progress" | "finished" | "expired";

export const RANDOM_TEST_ACTIVE = "RANDOM_TEST_ACTIVE";
export const RANDOM_TEST_NOT_ENOUGH = "RANDOM_TEST_NOT_ENOUGH";
export const RANDOM_TEST_NO_QUESTIONS = "RANDOM_TEST_NO_QUESTIONS";
export const RANDOM_TEST_TIME_UP = "RANDOM_TEST_TIME_UP";
export const RANDOM_TEST_FINISHED = "RANDOM_TEST_FINISHED";
export const RANDOM_TEST_ALREADY_ANSWERED = "RANDOM_TEST_ALREADY_ANSWERED";

export interface RandomTestSummary {
  id: string;
  size: number;
  total: number;
  status: RandomTestStatus;
  startedAt: string;
  deadlineAt: string;
  finishedAt: string | null;
  answered: number;
  correct: number;
  wrong: number;
  unanswered: number;
  percent: number;
  durationSec: number;
}

export interface RandomTestState extends RandomTestSummary {
  remainingMs: number;
  items: { answered: boolean; correct: boolean | null }[];
}

export interface RandomReview extends CheckAnswerResult {
  selectedOptionId: string | null;
}

export interface RandomQuestion {
  position: number;
  topicSlug: string;
  question: ApiQuestion;
  review: RandomReview | null;
}

export interface RandomOverview {
  sizes: number[];
  secondsPerQuestion: number;
  available: number;
  active: (RandomTestSummary & { remainingMs: number }) | null;
  history: RandomTestSummary[];
}

type RawReview = Omit<RandomReview, "keyword"> & { keyword: LocalizedText };

export function getRandomOverview(): Promise<RandomOverview> {
  return authFetch<RandomOverview>("/random-tests");
}

export function startRandomTest(size: number, allowFewer = false): Promise<RandomTestState> {
  return authFetch<RandomTestState>("/random-tests", { method: "POST", body: JSON.stringify({ size, ...(allowFewer ? { allowFewer: true } : {}) }) });
}

export function getRandomTest(id: string): Promise<RandomTestState> {
  return authFetch<RandomTestState>(`/random-tests/${id}`);
}

export async function getRandomQuestions(id: string, from: number, count = RANDOM_CHUNK): Promise<RandomQuestion[]> {
  const rows = await authFetch<(Omit<RandomQuestion, "question" | "review"> & { question: Parameters<typeof normalizeQuestion>[0]; review: RawReview | null })[]>(
    `/random-tests/${id}/questions?from=${from}&count=${count}`,
  );
  return rows.map((r) => ({ ...r, question: normalizeQuestion(r.question), review: r.review }));
}

export function answerRandomQuestion(id: string, position: number, optionId: string): Promise<{ review: RandomReview; state: RandomTestState }> {
  return authFetch(`/random-tests/${id}/answers`, { method: "POST", body: JSON.stringify({ position, optionId }) });
}

export function finishRandomTest(id: string): Promise<RandomTestState> {
  return authFetch<RandomTestState>(`/random-tests/${id}/finish`, { method: "POST" });
}
