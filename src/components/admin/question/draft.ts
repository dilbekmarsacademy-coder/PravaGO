// Savol muharririning holati va backend formatiga (QuestionInputDto) o'tkazish.

import type { LangRanges, Range, Texts } from "@/lib/admin/keywords";

export interface QuestionImage {
  url: string;
  width?: number | null;
  height?: number | null;
  assetId?: string | null;
}

export interface QuestionDraft {
  text: Texts;
  options: { id?: string; text: Texts }[];
  correctIndex: number | null;
  explanation: Texts;
  image: QuestionImage | null;
  /** Yangi tasdiqlangan rasm (assetId) yoki olib tashlash. */
  imageChange?: { assetId: string } | { remove: true };
  keywords: { none: boolean; question: LangRanges; answer: LangRanges };
  ruNeedsReview: boolean;
}

/** Backend'dagi EditableQuestionDto. */
export interface EditableQuestion {
  id: string;
  topicId: string;
  topicSlug: string;
  topicKind: string;
  order: number;
  text: Texts;
  options: { id: string; order: number; text: Texts; isCorrect: boolean }[];
  correctIndex: number | null;
  explanation: Texts;
  image: { url: string; width: number | null; height: number | null; assetId: string | null } | null;
  keywords: { none: boolean; question: LangRanges; answer: LangRanges; needsReview: boolean; source: string | null };
  needsReview: boolean;
  ruNeedsReview: boolean;
  updatedAt: string;
  deletedAt: string | null;
}

export const EMPTY_TEXTS: Texts = { cyrl: "", latn: "", ru: "" };

export function emptyDraft(): QuestionDraft {
  return {
    text: { ...EMPTY_TEXTS },
    options: [{ text: { ...EMPTY_TEXTS } }, { text: { ...EMPTY_TEXTS } }, { text: { ...EMPTY_TEXTS } }],
    correctIndex: null,
    explanation: { ...EMPTY_TEXTS },
    image: null,
    keywords: { none: false, question: {}, answer: {} },
    ruNeedsReview: true,
  };
}

export function draftFromQuestion(q: EditableQuestion): QuestionDraft {
  return {
    text: { ...q.text },
    options: q.options.map((o) => ({ id: o.id, text: { ...o.text } })),
    correctIndex: q.correctIndex,
    explanation: { ...q.explanation },
    image: q.image,
    keywords: { none: q.keywords.none, question: { ...q.keywords.question }, answer: { ...q.keywords.answer } },
    ruNeedsReview: q.ruNeedsReview,
  };
}

function cleanRanges(ranges: LangRanges): Record<string, Range[]> {
  return Object.fromEntries(Object.entries(ranges).filter(([, r]) => r && r.length > 0)) as Record<string, Range[]>;
}

function trimTexts(t: Texts): Texts {
  return { cyrl: t.cyrl.trim(), latn: t.latn.trim(), ru: t.ru.trim() };
}

export function toPayload(draft: QuestionDraft) {
  return {
    text: trimTexts(draft.text),
    options: draft.options.map((o) => ({ ...(o.id ? { id: o.id } : {}), text: trimTexts(o.text) })),
    correctIndex: draft.correctIndex ?? -1,
    explanation: trimTexts(draft.explanation),
    ...(draft.imageChange && "assetId" in draft.imageChange ? { imageAssetId: draft.imageChange.assetId } : {}),
    ...(draft.imageChange && "remove" in draft.imageChange ? { removeImage: true } : {}),
    keywords: draft.keywords.none
      ? { none: true }
      : { none: false, question: cleanRanges(draft.keywords.question), answer: cleanRanges(draft.keywords.answer) },
    ruNeedsReview: draft.ruNeedsReview,
  };
}

/** Klientdagi tekshiruv (backend ham xuddi shunday tekshiradi). */
export function validateDraft(draft: QuestionDraft): string | null {
  if (!draft.text.cyrl.trim() || !draft.text.latn.trim()) return "Savol matni kirill va lotin yozuvida bo'lishi kerak";
  if (draft.options.length < 2 || draft.options.length > 6) return "Variantlar 2 tadan 6 tagacha bo'lishi kerak";
  const bad = draft.options.findIndex((o) => !o.text.cyrl.trim() || !o.text.latn.trim());
  if (bad >= 0) return `${bad + 1}-variant matni kirill va lotinda bo'lishi kerak`;
  if (draft.correctIndex === null) return "To'g'ri javobni belgilang";
  if (!draft.keywords.none) {
    const any = Object.values(draft.keywords.question).some((r) => r?.length) || Object.values(draft.keywords.answer).some((r) => r?.length);
    if (!any) return "Kalit so'zni belgilang yoki \"Kalit so'z mavjud emas\"ni tanlang";
  }
  return null;
}
