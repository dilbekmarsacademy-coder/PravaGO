// Fayllararo moslashtirish (AI'siz, deterministik): javob va kalit so'zlarni boshqa
// fayllardan topish (mavzu + savol raqami VA matn o'xshashligi), dublikat va
// ziddiyatlar, saytda allaqachon bor savollar. Matnlar avval yagona yozuvga
// keltiriladi (normalizeForMatch) — kirill savol lotin kalitga solishtiriladi.

import { diceSimilarity, normalizeForMatch } from "./normalize";
import type { AnswerKeyEntry, CorrectBy, ExtractedQuestion, KeywordEntry } from "./parse/structure";
import type { MatchStatus } from "./types";

/** Matn juda o'xshash — aniq juftlik. */
export const MATCH_SURE = 0.85;
/** Shubhali oraliq — AI tasdiqlaydi. */
export const MATCH_MAYBE = 0.6;
export const DUPLICATE_THRESHOLD = 0.9;
export const EXISTING_THRESHOLD = 0.92;

export interface RawQuestion {
  /** Vaqtinchalik kalit (fayl + tartib). */
  key: string;
  fileId: string;
  fileName: string;
  q: ExtractedQuestion;
  day: number | null;
  topicNumber: number | null;
  topicTitle: string | null;
  imageIds: string[];
}

export interface KeySource {
  fileId: string;
  fileName: string;
  answerKeys: AnswerKeyEntry[];
  keywords: KeywordEntry[];
}

export interface MatchResult {
  correctIndex: number | null;
  correctBy: CorrectBy | "matched" | null;
  questionKey: string | null;
  answerKey: string | null;
  keySource: "file" | null;
  matchStatus: MatchStatus;
  matchScore: number | null;
  /** Qaysi fayldan javob/kalit olindi. */
  answerFrom: { fileId: string; fileName: string } | null;
  keysFrom: { fileId: string; fileName: string } | null;
  /** Shubhali nomzod (AI tasdiqlashi kerak). */
  candidate: { fileId: string; fileName: string; entry: KeywordEntry; score: number } | null;
}

function topicCompatible(a: { day: number | null; topicNumber: number | null }, b: { day: number | null; topicNumber: number | null }): boolean {
  return (a.day === null || b.day === null || a.day === b.day) && (a.topicNumber === null || b.topicNumber === null || a.topicNumber === b.topicNumber);
}

function topicKnownSame(a: { day: number | null; topicNumber: number | null }, b: { day: number | null; topicNumber: number | null }): boolean {
  return a.topicNumber !== null && a.topicNumber === b.topicNumber && (a.day === null || b.day === null || a.day === b.day);
}

/** Javob matnini variantga (istalgan yozuvda) moslash. */
export function optionByText(options: string[], answer: string): number | null {
  const target = normalizeForMatch(answer);
  if (!target) return null;
  const scored = options.map((o, i) => {
    const n = normalizeForMatch(o);
    const s = n === target ? 1 : n.includes(target) || target.includes(n) ? 0.9 : diceSimilarity(n, target);
    return { i, s };
  });
  scored.sort((a, b) => b.s - a.s);
  if (!scored[0] || scored[0].s < 0.75) return null;
  if (scored[1] && scored[0].s - scored[1].s < 0.08) return null;
  return scored[0].i;
}

/** Bitta savol uchun boshqa fayllardan javob va kalitlar. */
export function matchQuestion(raw: RawQuestion, sources: KeySource[]): MatchResult {
  const q = raw.q;
  const ownCorrect = q.correctIndex !== null;
  const res: MatchResult = {
    correctIndex: q.correctIndex,
    correctBy: q.correctBy,
    questionKey: q.questionKey,
    answerKey: q.answerKey,
    keySource: q.questionKey || q.answerKey ? "file" : null,
    matchStatus: ownCorrect ? "same_file" : "unmatched",
    matchScore: null,
    answerFrom: ownCorrect ? { fileId: raw.fileId, fileName: raw.fileName } : null,
    keysFrom: q.questionKey || q.answerKey ? { fileId: raw.fileId, fileName: raw.fileName } : null,
    candidate: null,
  };
  const qNorm = normalizeForMatch(q.text);
  const me = { day: raw.day, topicNumber: raw.topicNumber };

  // Kalit so'z / javob yozuvlari: matn o'xshashligi (raqam mos kelsa — qo'shimcha ishonch).
  let best: { src: KeySource; entry: KeywordEntry; score: number } | null = null;
  for (const src of sources) {
    for (const entry of src.keywords) {
      if (!topicCompatible(me, entry)) continue;
      let score = 0;
      if (entry.questionText) {
        score = diceSimilarity(qNorm, normalizeForMatch(entry.questionText));
        if (entry.number !== null && entry.number === q.number) score = Math.min(1, score + 0.08);
      } else if (entry.number !== null && entry.number === q.number && topicKnownSame(me, entry)) {
        // Matnsiz yozuv — faqat raqam va aniq mavzu bo'yicha.
        score = 0.86;
      }
      if (!best || score > best.score) best = { src, entry, score };
    }
  }
  if (best && best.score >= MATCH_SURE) {
    applyEntry(res, raw, best.src, best.entry, best.score);
  } else if (best && best.score >= MATCH_MAYBE) {
    res.candidate = { fileId: best.src.fileId, fileName: best.src.fileName, entry: best.entry, score: best.score };
    res.matchScore = best.score;
  }

  // Javoblar jadvali (raqam bo'yicha) — boshqa fayldagi.
  if (res.correctIndex === null && q.number !== null) {
    for (const src of sources) {
      if (src.fileId === raw.fileId) continue;
      const key = src.answerKeys.find((k) => k.number === q.number && topicKnownSame(me, k));
      if (key && key.optionIndex !== null && key.optionIndex < q.options.length) {
        res.correctIndex = key.optionIndex;
        res.correctBy = "matched";
        res.answerFrom = { fileId: src.fileId, fileName: src.fileName };
        if (res.matchStatus === "unmatched") res.matchStatus = "matched";
        res.matchScore = res.matchScore ?? 0.86;
        break;
      }
    }
  }
  return res;
}

/** Tasdiqlangan juftlik (aniq yoki AI tasdiqlagan) — javob va kalitlarni qo'llash. */
export function applyEntry(res: MatchResult, raw: RawQuestion, src: { fileId: string; fileName: string }, entry: KeywordEntry, score: number, status: MatchStatus = "matched"): void {
  const q = raw.q;
  let used = false;
  if (res.correctIndex === null && entry.answerText) {
    const idx = optionByText(q.options, entry.answerText);
    if (idx !== null) {
      res.correctIndex = idx;
      res.correctBy = "matched";
      res.answerFrom = { fileId: src.fileId, fileName: src.fileName };
      used = true;
    }
  }
  if (!res.questionKey && entry.questionKey) {
    res.questionKey = entry.questionKey;
    used = true;
  }
  if (!res.answerKey && entry.answerKey) {
    res.answerKey = entry.answerKey;
    used = true;
  }
  if (used && (entry.questionKey || entry.answerKey)) {
    res.keySource = "file";
    res.keysFrom = { fileId: src.fileId, fileName: src.fileName };
  }
  if (used && res.matchStatus !== "same_file") res.matchStatus = status;
  res.matchScore = score;
  res.candidate = null;
}

function optionsKey(options: string[]): Set<string> {
  return new Set(options.map(normalizeForMatch).filter(Boolean));
}

function setSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.max(a.size, b.size);
}

export interface DuplicateCluster {
  primary: number;
  members: number[];
  /** Turli fayllarda turli javob — admin tanlaydi. */
  conflict: { fileName: string; answer: string }[] | null;
}

/** Bir xil savollar (matn + variantlar) — eng to'liq varianti qoladi; javoblar farq qilsa — ziddiyat. */
export function findDuplicates(items: { text: string; options: string[]; correctIndex: number | null; hasImage: boolean; hasKeys: boolean; fileName: string }[]): DuplicateCluster[] {
  const norms = items.map((it) => ({ text: normalizeForMatch(it.text), opts: optionsKey(it.options) }));
  const taken = new Array<boolean>(items.length).fill(false);
  const clusters: DuplicateCluster[] = [];
  for (let i = 0; i < items.length; i++) {
    if (taken[i]) continue;
    const members = [i];
    for (let j = i + 1; j < items.length; j++) {
      if (taken[j]) continue;
      if (diceSimilarity(norms[i].text, norms[j].text) >= DUPLICATE_THRESHOLD && setSimilarity(norms[i].opts, norms[j].opts) >= 0.75) members.push(j);
    }
    if (members.length < 2) continue;
    members.forEach((m) => (taken[m] = true));
    const score = (k: number) => (items[k].hasImage ? 4 : 0) + (items[k].correctIndex !== null ? 3 : 0) + (items[k].hasKeys ? 1 : 0) + items[k].options.length * 0.1;
    const primary = [...members].sort((a, b) => score(b) - score(a))[0];
    const answers = members
      .filter((m) => items[m].correctIndex !== null)
      .map((m) => ({ fileName: items[m].fileName, answer: items[m].options[items[m].correctIndex!] ?? "" }));
    const distinct = new Set(answers.map((a) => normalizeForMatch(a.answer)));
    clusters.push({ primary, members, conflict: distinct.size > 1 ? answers : null });
  }
  return clusters;
}

export interface SiteQuestion {
  id: string;
  topicSlug: string;
  text: string;
  options: string[];
}

export interface PreparedSite {
  rows: { id: string; topicSlug: string; norm: string; opts: Set<string> }[];
}

export function prepareSite(site: SiteQuestion[]): PreparedSite {
  return { rows: site.map((s) => ({ id: s.id, topicSlug: s.topicSlug, norm: normalizeForMatch(s.text), opts: optionsKey(s.options) })) };
}

/** Saytda allaqachon bor savol (matn ≥ 0.92 va variantlar mos). */
export function findExisting(site: PreparedSite, text: string, options: string[]): { questionId: string; topicSlug: string; score: number } | null {
  const norm = normalizeForMatch(text);
  if (norm.length < 8) return null;
  const opts = optionsKey(options);
  let best: { questionId: string; topicSlug: string; score: number } | null = null;
  for (const row of site.rows) {
    const ratio = row.norm.length / norm.length;
    if (ratio < 0.7 || ratio > 1.4) continue;
    const s = diceSimilarity(norm, row.norm);
    if (s >= EXISTING_THRESHOLD && setSimilarity(opts, row.opts) >= 0.6 && (!best || s > best.score)) best = { questionId: row.id, topicSlug: row.topicSlug, score: s };
  }
  return best;
}
