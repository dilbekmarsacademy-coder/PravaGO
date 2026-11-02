// Fayllararo moslashtirish uchun matnni yagona ko'rinishga keltirish (deterministik):
// kirill → lotin (saytdagi transliteratsiya bilan bir xil), kichik harf, apostroflar
// bir xil, tinish belgilari va ortiqcha bo'sh joy olib tashlanadi. Shunda kirill
// savol va lotin kalit so'z bir-biriga solishtiriladi.

import { cyrillicToLatin } from "../common/translit";

const CYRILLIC = /[Ѐ-ӿ]/;

export type Script = "cyrl" | "latn" | "mixed" | "none";

export function detectScript(text: string): Script {
  let cyr = 0;
  let lat = 0;
  for (const ch of text) {
    if (CYRILLIC.test(ch)) cyr++;
    else if (/[A-Za-z]/.test(ch)) lat++;
  }
  if (cyr + lat === 0) return "none";
  if (cyr / (cyr + lat) > 0.8) return "cyrl";
  if (lat / (cyr + lat) > 0.8) return "latn";
  return "mixed";
}

/** Taqqoslash uchun: lotin, kichik harf, faqat harf/raqam va bitta bo'shliq. */
export function normalizeForMatch(text: string): string {
  const latin = CYRILLIC.test(text) ? cyrillicToLatin(text) : text;
  return latin
    .toLowerCase()
    .replace(/[ʻʼ‘’`´']/g, "'")
    .replace(/o'|g'/g, (m) => m[0] + "q") // o' / g' — alohida harf (o'q ≠ oq)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ortiqcha bo'sh joy va boshidagi raqamlashni tozalash (asl matn o'zgarmaydi). */
export function cleanText(text: string): string {
  return text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function bigrams(s: string): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** 0..1 — Sørensen–Dice (bigram) o'xshashligi; normallashtirilgan matnlar uchun. */
export function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) ?? 0);
  return (2 * inter) / (a.length - 1 + (b.length - 1));
}

/** Ikki matn (istalgan yozuvda) qanchalik o'xshash. */
export function textSimilarity(a: string, b: string): number {
  return diceSimilarity(normalizeForMatch(a), normalizeForMatch(b));
}

/** `needle` `haystack` ichida (normallashtirilgan holda) bormi — kalit so'z savolga tegishlimi. */
export function containsNormalized(haystack: string, needle: string): boolean {
  const n = normalizeForMatch(needle);
  return n.length > 0 && normalizeForMatch(haystack).includes(n);
}

/**
 * Asl matnda (kirill yoki lotin) kalit iborani topish — belgilash oralig'i [start, end).
 * Ibora istalgan yozuvda berilishi mumkin; topilmasa null.
 */
export function findPhraseRange(text: string, phrase: string): [number, number] | null {
  const target = normalizeForMatch(phrase);
  if (!target) return null;
  // Har bir so'z boshidan boshlab normallashgan bo'laklarni solishtiramiz.
  const words = [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'ʻʼ‘’`-]*/gu)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
  const need = target.split(" ").length;
  for (let i = 0; i < words.length; i++) {
    for (let len = Math.max(1, need - 1); len <= need + 1 && i + len <= words.length; len++) {
      const start = words[i].start;
      const end = words[i + len - 1].end;
      if (normalizeForMatch(text.slice(start, end)) === target) return [start, end];
    }
  }
  return null;
}
