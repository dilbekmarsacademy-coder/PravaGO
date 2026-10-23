// "Kalit so'zlar" bo'limi API qatlami. Kirish huquqi mavzu testi bilan bir xil:
// video ko'rilmagan bo'lsa backend `ApiError(403, "LESSON_NOT_COMPLETED")` qaytaradi.
// "Ko'rib chiqdim" belgisi serverda foydalanuvchiga bog'lab saqlanadi.

import type { LocalizedText } from "@/lib/i18n/localized";
import { authFetch } from "./session";
import { resolveAssetUrl, type QuestionKeywords } from "./test";

export interface KeywordCard {
  id: string;
  order: number;
  text: LocalizedText;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  /** To'g'ri javob matni (javob kaliti belgilashi shu matnga nisbatan). */
  correctAnswer: LocalizedText | null;
  explanation: LocalizedText | null;
  /** `null` — kalit so'z mavjud emas. */
  keywords: QuestionKeywords | null;
  reviewed: boolean;
}

export interface KeywordList {
  total: number;
  reviewedCount: number;
  items: KeywordCard[];
}

export interface ReviewResult {
  questionId: string;
  reviewed: boolean;
  total: number;
  reviewedCount: number;
}

export async function getTopicKeywords(topicSlug: string): Promise<KeywordList> {
  const list = await authFetch<KeywordList>(`/topics/${topicSlug}/keywords`);
  return { ...list, items: list.items.map((item) => ({ ...item, imageUrl: resolveAssetUrl(item.imageUrl) })) };
}

export function setKeywordReviewed(topicSlug: string, questionId: string, reviewed: boolean): Promise<ReviewResult> {
  return authFetch<ReviewResult>(`/topics/${topicSlug}/keywords/${questionId}/review`, {
    method: "PUT",
    body: JSON.stringify({ reviewed }),
  });
}
