// "Saqlanganlar" API qatlami. To'g'ri javob va kalit so'z faqat `getSavedList`
// javobida keladi (va imtihon urinishi yakunlanmagan bo'lsa — kelmaydi).
// Test sahifasi faqat id'larni oladi.

import type { Locale } from "@/lib/i18n/dictionary";
import type { LocalizedText } from "@/lib/i18n/localized";
import type { ApiQuestion } from "./test";
import { authFetch } from "./session";

export type SavedSourceMode = "practice" | "exam";
export type SavedSort = "new" | "old";

export interface SavedRecord {
  questionId: string;
  topicSlug: string;
  sourceMode: SavedSourceMode;
  attemptId: string | null;
  note: string | null;
  createdAt: string;
}

export interface SavedItem extends SavedRecord {
  question: {
    order: number;
    text: LocalizedText;
    imageUrl: string;
    imageWidth: number | null;
    imageHeight: number | null;
    options: { id: string; text: LocalizedText }[];
  };
  answerLocked: boolean;
  correctOptionId?: string;
  keyword?: LocalizedText;
}

export interface SavedPage {
  items: SavedItem[];
  nextCursor: string | null;
}

export interface SavedCount {
  total: number;
  limit: number;
  byTopic: { topicSlug: string; count: number }[];
}

export interface SavedListParams {
  lang: Locale;
  topicSlug?: string | null;
  q?: string;
  sort?: SavedSort;
  cursor?: string | null;
  limit?: number;
}

export interface PracticeQuestion extends ApiQuestion {
  topicSlug: string;
}

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function saveQuestion(questionId: string, sourceMode: SavedSourceMode, attemptId?: string): Promise<SavedRecord> {
  return authFetch<SavedRecord>("/saved", {
    method: "POST",
    body: JSON.stringify({ questionId, sourceMode, ...(attemptId ? { attemptId } : {}) }),
  });
}

export function unsaveQuestion(questionId: string): Promise<void> {
  return authFetch<void>(`/saved/${questionId}`, { method: "DELETE" });
}

export function updateSavedNote(questionId: string, note: string | null): Promise<SavedRecord> {
  return authFetch<SavedRecord>(`/saved/${questionId}`, { method: "PATCH", body: JSON.stringify({ note }) });
}

export async function getSavedIds(topicSlug?: string): Promise<string[]> {
  const { ids } = await authFetch<{ ids: string[] }>(`/saved/ids${query({ topicSlug })}`);
  return ids;
}

export function getSavedCount(): Promise<SavedCount> {
  return authFetch<SavedCount>("/saved/count");
}

export function getSavedList(params: SavedListParams): Promise<SavedPage> {
  return authFetch<SavedPage>(`/saved${query({ ...params })}`);
}

/** Saqlangan savollar — test formatida (javobsiz), "test qilib ishlash" uchun. */
export function getSavedPracticeQuestions(topicSlug?: string | null): Promise<PracticeQuestion[]> {
  return authFetch<PracticeQuestion[]>(`/saved/practice${query({ topicSlug })}`);
}
