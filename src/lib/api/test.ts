// Test/Savollar backend moduli bilan ishlaydigan API qatlami.
// Backend hech qachon to'g'ri javob/kalit so'zni savollar ro'yxatida
// qaytarmaydi — ular faqat check-answer javobida keladi.

import type { LocalizedText } from "@/lib/i18n/localized";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// Matnlar uch tilda keladi — til almashganda qayta so'rov yubormasdan
// `localize()` orqali tanlanadi.
export interface ApiOption {
  id: string;
  text: LocalizedText;
}

export interface ApiQuestion {
  id: string;
  text: LocalizedText;
  imageUrl: string;
  options: ApiOption[];
}

export interface CheckAnswerResult {
  correct: boolean;
  correctOptionId: string;
  keyword: LocalizedText;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`So'rov muvaffaqiyatsiz tugadi: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Eski backend matnni oddiy satr sifatida qaytaradi — deploy vaqtida ikkala
// versiya bilan ham ishlash uchun satrni `{ uz | cyrl }` ga aylantiramiz.
type RawText = string | LocalizedText;

function toLocalizedText(raw: RawText): LocalizedText {
  if (typeof raw !== "string") return raw;
  if (!raw.trim()) return {};
  return /[\u0400-\u04FF]/.test(raw) ? { cyrl: raw } : { uz: raw };
}

interface RawQuestion extends Omit<ApiQuestion, "text" | "options"> {
  text: RawText;
  options: { id: string; text: RawText }[];
}

export async function getTopicQuestions(topicSlug: string): Promise<ApiQuestion[]> {
  const questions = await apiFetch<RawQuestion[]>(`/topics/${topicSlug}/questions`);
  return questions.map((q) => ({
    ...q,
    text: toLocalizedText(q.text),
    options: q.options.map((o) => ({ id: o.id, text: toLocalizedText(o.text) })),
  }));
}

export async function checkAnswer(questionId: string, optionId: string): Promise<CheckAnswerResult> {
  const result = await apiFetch<Omit<CheckAnswerResult, "keyword"> & { keyword: RawText }>(
    `/questions/${questionId}/check-answer`,
    { method: "POST", body: JSON.stringify({ optionId }) },
  );
  return { ...result, keyword: toLocalizedText(result.keyword) };
}
