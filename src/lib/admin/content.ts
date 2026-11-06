"use client";

import { adminFetch } from "./api";
import type { TranslateResult } from "@/components/admin/question/QuestionEditor";
import type { EditableQuestion, QuestionDraft } from "@/components/admin/question/draft";
import type { LangRanges, Range, Texts } from "./keywords";

let aiStatus: Promise<boolean> | null = null;

/** ANTHROPIC_API_KEY backend'da sozlanganmi (bir marta so'raladi). */
export function getAiConfigured(): Promise<boolean> {
  aiStatus ??= adminFetch<{ configured: boolean }>("ai/status")
    .then((r) => r.configured)
    .catch(() => false);
  return aiStatus;
}

/** Ruscha tarjima — manba sifatida lotin yozuvi (bo'lmasa kirill). */
export function translateDraft(draft: QuestionDraft): Promise<TranslateResult> {
  const uz = (t: { latn: string; cyrl: string }) => t.latn.trim() || t.cyrl.trim();
  return adminFetch<TranslateResult>("ai/translate", {
    json: { text: uz(draft.text), options: draft.options.map((o) => uz(o.text)), explanation: uz(draft.explanation) },
  });
}

export type KeywordMode = "ai" | "manual";

/** Admin lotinda yozgan yangi savol (kun mavzusi uchun). */
export interface NewQuestionInput {
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  keywords: { mode: KeywordMode; question?: Range[]; answer?: Range[] };
}

/** AI tayyorlagan savol: uch tilda matn va kalit so'z belgilari — admin tasdiqlaydi. */
export interface PreparedQuestion {
  text: Texts;
  options: { text: Texts }[];
  correctIndex: number;
  explanation: Texts;
  keywords: { none: boolean; question: LangRanges; answer: LangRanges };
  warnings: string[];
}

export function prepareTopicQuestion(slug: string, input: NewQuestionInput): Promise<PreparedQuestion> {
  return adminFetch<PreparedQuestion>(`content/topics/${slug}/questions/prepare`, { json: input });
}

export function createTopicQuestion(slug: string, prepared: PreparedQuestion, imageAssetId?: string): Promise<EditableQuestion> {
  const { text, options, correctIndex, explanation, keywords } = prepared;
  return adminFetch<EditableQuestion>(`content/topics/${slug}/questions`, {
    json: { text, options, correctIndex, explanation, keywords, ...(imageAssetId ? { imageAssetId } : {}) },
  });
}
