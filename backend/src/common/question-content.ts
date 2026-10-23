// Savol kontentini API javobiga aylantirish — test, "Saqlanganlar" va
// "Kalit so'zlar" bo'limlarida bir xil format.
//
// Kalit so'zlar (va to'g'ri javob) faqat javob berilgandan keyin yoki
// "Kalit so'zlar" bo'limida chiqariladi — savollar ro'yxatida hech qachon.

import type { Option, Prisma, Question, QuestionKeyword } from "@prisma/client";
import { toLocalizedText, type LocalizedTextDto } from "./localized-text";

/** Variantlar manbadagi tartibda (F1, F2, ...). Eski yozuvlarda tartib 0 — yaratilish vaqti bo'yicha. */
export const OPTION_ORDER: Prisma.OptionOrderByWithRelationInput[] = [{ order: "asc" }, { createdAt: "asc" }, { id: "asc" }];

export function questionText(q: Pick<Question, "text" | "textRu" | "textLatn">): LocalizedTextDto {
  return toLocalizedText(q.text, q.textRu, q.textLatn);
}

export function optionText(o: Pick<Option, "text" | "textRu" | "textLatn">): LocalizedTextDto {
  return toLocalizedText(o.text, o.textRu, o.textLatn);
}

export type HighlightRange = [number, number];

/** Matndagi belgilash `[start, end)` — har bir til matniga nisbatan. */
export interface HighlightDto {
  uz?: HighlightRange;
  cyrl?: HighlightRange;
  ru?: HighlightRange;
}

export interface KeywordPartDto {
  /** Kalit so'zning o'zi (chip uchun). */
  text: LocalizedTextDto;
  /** Savol kaliti — savol matnida, javob kaliti — to'g'ri variant matnida. */
  highlight: HighlightDto;
}

/** `null` — kalit so'z mavjud emas. Qismlardan biri ham `null` bo'lishi mumkin. */
export interface QuestionKeywordsDto {
  question: KeywordPartDto | null;
  answer: KeywordPartDto | null;
}

function isRange(value: unknown): value is HighlightRange {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => Number.isInteger(n) && n >= 0) &&
    (value[0] as number) < (value[1] as number)
  );
}

function toHighlight(value: unknown): HighlightDto {
  const out: HighlightDto = {};
  if (!value || typeof value !== "object") return out;
  for (const lang of ["uz", "cyrl", "ru"] as const) {
    const range = (value as Record<string, unknown>)[lang];
    if (isRange(range)) out[lang] = range;
  }
  return out;
}

function part(
  latin: string | null,
  cyrillic: string | null,
  russian: string | null,
  highlight: unknown,
): KeywordPartDto | null {
  if (!latin && !cyrillic) return null;
  const text: LocalizedTextDto = {};
  if (latin) text.uz = latin;
  if (cyrillic) text.cyrl = cyrillic;
  if (russian) text.ru = russian;
  return { text, highlight: toHighlight(highlight) };
}

export function toKeywordsDto(row: QuestionKeyword | null | undefined): QuestionKeywordsDto | null {
  if (!row) return null;
  const highlights = (row.highlights ?? {}) as Record<string, unknown>;
  const question = part(row.questionText, row.questionTextCyrl, row.questionTextRu, highlights.question);
  const answer = part(row.answerText, row.answerTextCyrl, row.answerTextRu, highlights.answer);
  return question || answer ? { question, answer } : null;
}
