// AI import qoralamalari: ImportQuestion.data va ImportFile.extracted shakllari.

import type { CorrectBy, ExtractedStructure } from "./parse/structure";

export interface Texts {
  cyrl: string;
  latn: string;
  ru: string;
}

export type MatchStatus = "same_file" | "matched" | "ai_matched" | "unmatched";
export type Confidence = "high" | "medium" | "low";

export interface SourceRef {
  fileId: string;
  fileName: string;
  /** question | answer | keywords */
  part: "question" | "answer" | "keywords";
}

/** ImportQuestion.data */
export interface QDraft {
  text: Texts;
  options: Texts[];
  /** Manba yozuvi (asl matn shu yozuvda). */
  script: "cyrl" | "latn";
  correctIndex: number | null;
  /** file — fayldan; ai — hech bir faylda topilmadi, AI taxmini. */
  correctSource: "file" | "ai" | null;
  correctBy: CorrectBy | "matched" | null;
  /** Fayldagi javob AI fikriga zid — javob fayldagidek, ogohlantirish bilan. */
  aiDoubt: string | null;
  /** AI taxminining qisqa asosi. */
  aiReason: string | null;
  keywords: { question: string | null; answer: string | null; source: "file" | "ai" | null };
  explanation: Texts | null;
  explanationSource: "ai" | "file" | null;
  confidence: Confidence | null;
  problems: string[];
  ruNeedsReview: boolean;
  sources: SourceRef[];
  /** Fayllararo moslashtirish ishonchi (0..1) va AI tasdiqlashi kerak bo'lgan nomzod. */
  matchScore: number | null;
  matchCandidate: { fileId: string; fileName: string; questionText: string | null; answerText: string | null; optionIndex: number | null; questionKey: string | null; answerKey: string | null } | null;
  /** Saytda allaqachon bor (standart holatda qo'shilmaydi). */
  existsOnSite: { questionId: string; topicSlug: string; score: number } | null;
  analysisAttempts: number;
  /** Admin tahrirlaganmi (audit uchun). */
  edited: boolean;
}

/** ImportFile.extracted */
export interface ExtractedJson {
  structure: ExtractedStructure;
  preview: string;
  script: string;
  title: string | null;
  /** Fayl ichidagi rasm havolasi → ImportImage.id */
  images: Record<string, string>;
}

/** ImportFile.classification */
export interface FileClassification {
  kind: "questions_full" | "questions_only" | "keys_only" | "mixed" | "unrelated";
  topics: { day: number | null; topicNumber: number | null; title: string | null }[];
  questionCount: number;
  script: "cyrl" | "latn" | "mixed";
  language: "uz" | "ru" | "other";
  reason: string | null;
  source: "ai" | "rules";
}

export interface BatchStats {
  files?: { total: number; extracted: number; classified: number; skipped: number; error: number };
  questions?: { total: number; analyzed: number; duplicates: number; conflicts: number; existing: number; reviewNeeded: number };
  images?: { total: number; done: number; needsReview: number; error: number };
  tests?: number;
  estimate?: { usd: number; questions: number; images: number; files: number };
  message?: string;
}
