"use client";

// "AI bilan fayllardan qo'shish" — admin API turlari va yordamchilar.
// Fayllar storage'ga to'g'ridan-to'g'ri (R2 presigned PUT) yoki admin proxy orqali yuklanadi.

import { adminFetch } from "@/lib/admin/api";

export const ACCEPTED_EXTENSIONS = [".docx", ".pdf", ".html", ".htm", ".txt", ".zip"];
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export interface Texts {
  cyrl: string;
  latn: string;
  ru: string;
}

export interface BatchStats {
  files?: { total: number; extracted: number; classified: number; skipped: number; error: number };
  questions?: { total: number; analyzed: number; duplicates: number; conflicts: number; existing: number; reviewNeeded: number };
  images?: { total: number; done: number; needsReview: number; error: number };
  tests?: number;
  estimate?: { usd: number; questions: number; images: number; files: number };
  message?: string;
}

/** uploading | ready | processing | paused | review | partial_error | done */
export type BatchStatus = string;

export interface ImportListItem {
  id: string;
  status: BatchStatus;
  stage: string;
  groupName: string | null;
  fileCount: number;
  stats: BatchStats;
  createdAt: string;
  createdBy: string | null;
  error: string | null;
}

export interface ImportFileRow {
  id: string;
  parentId: string | null;
  name: string;
  size: number;
  status: string;
  kind: string | null;
  skipReason: string | null;
  error: string | null;
  classification: { kind: string; topics: { day: number | null; topicNumber: number | null; title: string | null }[]; questionCount: number; reason: string | null } | null;
  attempts: number;
}

export interface ImportTestRow {
  id: string;
  title: string;
  day: number | null;
  topicNumber: number | null;
  topicTitle: string | null;
  groupId: string | null;
  linkedTopicSlug: string | null;
  suggestions: { slug: string; title: string; score: number }[];
  status: "draft" | "approved";
  publishedTopicId: string | null;
  questionCount: number;
  approvedCount: number;
  reviewCount: number;
}

export interface BudgetState {
  spentUsd: number;
  budgetUsd: number;
  ratio: number;
  level: "ok" | "warn" | "blocked";
}

export interface ImportDetail {
  id: string;
  status: BatchStatus;
  stage: string;
  error: string | null;
  removeWatermarks: boolean;
  stats: BatchStats;
  createdAt: string;
  group: { id: string; name: string } | null;
  files: ImportFileRow[];
  tests: ImportTestRow[];
  budget: BudgetState;
  aiConfigured: boolean;
  storage: { driver: string; maxUploadBytes: number };
}

export interface ImageBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface QDraft {
  text: Texts;
  options: Texts[];
  script: "cyrl" | "latn";
  correctIndex: number | null;
  correctSource: "file" | "ai" | null;
  correctBy: string | null;
  aiDoubt: string | null;
  aiReason: string | null;
  keywords: { question: string | null; answer: string | null; source: "file" | "ai" | null };
  explanation: Texts | null;
  explanationSource: "ai" | "file" | null;
  confidence: "high" | "medium" | "low" | null;
  problems: string[];
  ruNeedsReview: boolean;
  sources: { fileId: string; fileName: string; part: "question" | "answer" | "keywords" }[];
  matchScore: number | null;
  matchCandidate: { fileName: string; questionText: string | null; answerText: string | null } | null;
  existsOnSite: { questionId: string; topicSlug: string; score: number } | null;
  edited: boolean;
}

export type ImageVariant = "original" | "cleaned" | "crop";

export interface ReviewQuestion {
  id: string;
  order: number;
  number: number | null;
  data: QDraft;
  matchStatus: "same_file" | "matched" | "ai_matched" | "unmatched";
  /** Bir xil savol turli fayllarda turli javob bilan. */
  conflict: { fileName: string; answer: string }[] | null;
  approved: boolean;
  review: boolean;
  imageProblem: boolean;
  bulkApprovable: boolean;
  image: {
    id: string;
    status: string;
    needsReview: boolean;
    selected: ImageVariant;
    hasCleaned: boolean;
    hasCrop: boolean;
    boxes: ImageBox[];
    width: number | null;
    height: number | null;
    note: string | null;
  } | null;
}

export interface StepResult {
  busy?: boolean;
  status: BatchStatus;
  stage: string;
  stats: BatchStats;
  continue: boolean;
}

type UploadTarget = { method: "PUT"; url: string; headers: Record<string, string> } | { method: "POST"; url: null };

export interface CreateResult {
  batchId: string;
  uploads: { fileId: string; name: string; target: UploadTarget }[];
  driver: string;
}

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
}

export function imageUrl(imageId: string, variant: ImageVariant, version?: number | string): string {
  return `/admin/api/ai-imports/images/${imageId}/${variant}${version ? `?v=${version}` : ""}`;
}

/** Bitta faylni yuklash: R2 bo'lsa to'g'ridan-to'g'ri, aks holda proxy orqali (≤ 4 MB). */
export async function uploadImportFile(batchId: string, upload: CreateResult["uploads"][number], file: File): Promise<void> {
  if (upload.target.method === "PUT") {
    const res = await fetch(upload.target.url, { method: "PUT", headers: upload.target.headers, body: file });
    if (!res.ok) throw new Error(`"${file.name}" yuklanmadi (${res.status})`);
    await adminFetch(`ai-imports/${batchId}/files/${upload.fileId}/uploaded`, { method: "POST" });
    return;
  }
  const form = new FormData();
  form.append("file", file, file.name);
  await adminFetch(`ai-imports/${batchId}/files/${upload.fileId}/upload`, { method: "POST", body: form });
}

export const STATUS_LABEL: Record<string, string> = {
  uploading: "Fayllar ochilmoqda",
  ready: "Boshlashga tayyor",
  processing: "AI tahlil qilmoqda",
  paused: "To'xtatilgan",
  review: "Tekshirish kutilmoqda",
  partial_error: "Qisman xato",
  done: "Tugagan",
};

export const STAGE_LABEL: Record<string, string> = {
  extract: "Fayllarni ochish",
  ready: "Taxminiy narx",
  classify: "Fayllarni tasniflash",
  group: "Testlarga ajratish",
  match: "Fayllararo moslashtirish",
  analyze: "Savollarni tahlil qilish",
  images: "Rasmlarni tozalash",
  done: "Tayyor",
};

export const CORRECT_BY_LABEL: Record<string, string> = {
  symbol: "belgi (✓, *, +)",
  answer_line: "“To'g'ri javob” qatori",
  highlight: "sariq fon",
  color: "rangli matn",
  bold: "qalin matn",
  table: "javoblar jadvali",
  matched: "boshqa fayl (javoblar)",
};

export const FILE_KIND_LABEL: Record<string, string> = {
  questions_full: "Savol + javob",
  questions_only: "Faqat savollar",
  keys_only: "Faqat javob/kalitlar",
  mixed: "Aralash",
  unrelated: "Aloqasiz",
};

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
