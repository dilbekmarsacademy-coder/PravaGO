"use client";

import { adminFetch } from "./api";
import type { TranslateResult } from "@/components/admin/question/QuestionEditor";
import type { QuestionDraft } from "@/components/admin/question/draft";

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
