// Test/Savollar backend moduli bilan ishlaydigan API qatlami.
// Backend hech qachon to'g'ri javob/kalit so'zni savollar ro'yxatida
// qaytarmaydi — ular faqat check-answer javobida keladi.

import type { LocalizedText } from "@/lib/i18n/localized";
import { authFetch } from "./session";

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
  /** To'liq URL; rasmsiz savolda null. */
  imageUrl: string | null;
  /** Asl o'lchamlar (eski backend'da bo'lmasligi mumkin). */
  imageWidth?: number | null;
  imageHeight?: number | null;
  options: ApiOption[];
}

/** Matndagi belgilash `[start, end)` — har bir til matniga nisbatan. */
export interface HighlightRanges {
  uz?: [number, number];
  cyrl?: [number, number];
  ru?: [number, number];
}

export interface KeywordPart {
  /** Kalit so'zning o'zi (chip uchun). */
  text: LocalizedText;
  /** Savol kaliti — savol matnida, javob kaliti — to'g'ri variant matnida. */
  highlight: HighlightRanges;
}

/** `null` — kalit so'z mavjud emas. */
export interface QuestionKeywords {
  question: KeywordPart | null;
  answer: KeywordPart | null;
}

export interface CheckAnswerResult {
  correct: boolean;
  correctOptionId: string;
  keyword: LocalizedText;
  /** Eski backend'da bo'lmaydi (`undefined`); `null` — kalit so'z mavjud emas. */
  keywords?: QuestionKeywords | null;
}

/**
 * Backend rasm yo'lini `/images/...` ko'rinishida (API manziliga nisbatan)
 * qaytaradi — shu yerda to'liq URL'ga aylantiriladi. Eski yozuvlar to'liq URL.
 */
export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${API_BASE_URL}${url}` : url;
}

// Eski backend matnni oddiy satr sifatida qaytaradi — deploy vaqtida ikkala
// versiya bilan ham ishlash uchun satrni `{ uz | cyrl }` ga aylantiramiz.
type RawText = string | LocalizedText;

function toLocalizedText(raw: RawText): LocalizedText {
  if (typeof raw !== "string") return raw;
  if (!raw.trim()) return {};
  return /[Ѐ-ӿ]/.test(raw) ? { cyrl: raw } : { uz: raw };
}

interface RawQuestion extends Omit<ApiQuestion, "text" | "options"> {
  text: RawText;
  options: { id: string; text: RawText }[];
}

/** API'dan kelgan savolni klient formatiga keltiradi (matnlar, rasm URL'i). */
export function normalizeQuestion<T extends RawQuestion>(q: T): Omit<T, "text" | "options"> & ApiQuestion {
  return {
    ...q,
    text: toLocalizedText(q.text),
    imageUrl: resolveAssetUrl(q.imageUrl),
    options: q.options.map((o) => ({ id: o.id, text: toLocalizedText(o.text) })),
  };
}

/**
 * Video darsi bor mavzu uchun sessiya kerak: dars ko'rilmagan bo'lsa backend
 * `ApiError(403, "LESSON_NOT_COMPLETED")` qaytaradi.
 */
export async function getTopicQuestions(topicSlug: string): Promise<ApiQuestion[]> {
  const questions = await authFetch<RawQuestion[]>(`/topics/${topicSlug}/questions`);
  return questions.map(normalizeQuestion);
}

export async function checkAnswer(questionId: string, optionId: string): Promise<CheckAnswerResult> {
  const result = await authFetch<Omit<CheckAnswerResult, "keyword"> & { keyword: RawText }>(
    `/questions/${questionId}/check-answer`,
    { method: "POST", body: JSON.stringify({ optionId }) },
  );
  return { ...result, keyword: toLocalizedText(result.keyword) };
}

export interface TestAttempt {
  topicSlug: string;
  correct: number;
  total: number;
  percent: number;
  createdAt: string;
}

/** To'liq mavzu testi natijasi — foizni server javoblarni qayta tekshirib hisoblaydi. */
export function submitTestAttempt(
  topicSlug: string,
  answers: { questionId: string; optionId: string }[],
): Promise<TestAttempt> {
  return authFetch<TestAttempt>(`/topics/${topicSlug}/attempts`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export function listTestAttempts(): Promise<TestAttempt[]> {
  return authFetch<TestAttempt[]>("/attempts");
}
