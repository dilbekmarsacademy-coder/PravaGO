// Admin panel: kalit so'z belgilash uchun sof yordamchilar (React'siz, unit test qilinadi).
// Oraliq `[start, end)` — saqlangan matnga nisbatan (bir nechta bo'lak bo'lishi mumkin).

import { cyrillicToLatin, latinToCyrillic } from "@/lib/i18n/translit";

export type Range = [number, number];
export type KwLang = "uz" | "cyrl" | "ru";
export type LangRanges = Partial<Record<KwLang, Range[]>>;
export type Texts = { cyrl: string; latn: string; ru: string };

export const KW_LANGS: KwLang[] = ["cyrl", "uz", "ru"];

export function textOf(texts: Texts, lang: KwLang): string {
  return lang === "uz" ? texts.latn : lang === "cyrl" ? texts.cyrl : texts.ru;
}

/** Yangi oraliq qo'shadi: kesishganlari bilan birlashtiradi, tartiblaydi. */
export function addRange(ranges: Range[] | undefined, next: Range): Range[] {
  const [s, e] = next[0] <= next[1] ? next : [next[1], next[0]];
  if (s === e) return ranges ?? [];
  const all = [...(ranges ?? []), [s, e] as Range].sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const r of all) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

export function removeRange(ranges: Range[] | undefined, index: number): Range[] {
  return (ranges ?? []).filter((_, i) => i !== index);
}

/** Bo'sh joylarni chetidan qirqadi (belgilash so'z chegarasida bo'lsin). */
export function trimRange(text: string, [s, e]: Range): Range | null {
  let start = s;
  let end = e;
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return end > start ? [start, end] : null;
}

/** Chip matni — backend bilan bir xil: bo'laklar katta harflarda, " + " bilan. */
export function chipText(text: string, ranges: Range[] | undefined): string {
  if (!text || !ranges?.length) return "";
  return ranges
    .map(([s, e]) => text.slice(s, e).trim().toUpperCase())
    .filter(Boolean)
    .join(" + ");
}

export function rangesValid(text: string, ranges: Range[] | undefined): boolean {
  if (!ranges?.length) return true;
  let pos = 0;
  for (const [s, e] of ranges) {
    if (!Number.isInteger(s) || !Number.isInteger(e) || s < pos || s >= e || e > text.length) return false;
    pos = e;
  }
  return true;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[‘’ʻʼ`]/g, "'");
}

/**
 * Boshqa o'zbek yozuvi uchun taklif: belgilangan bo'lakni transliteratsiya
 * qilib, ikkinchi matndan qidiradi. Bir nechta moslik bo'lsa — matndagi nisbiy
 * o'rniga eng yaqini. Topilmasa — null (admin qo'lda belgilaydi).
 */
export function suggestRange(from: { text: string; range: Range; lang: "uz" | "cyrl" }, targetText: string): Range | null {
  const piece = from.text.slice(from.range[0], from.range[1]);
  if (!piece.trim() || !targetText) return null;
  const converted = from.lang === "cyrl" ? cyrillicToLatin(piece) : latinToCyrillic(piece);
  const needle = normalize(converted.trim());
  const haystack = normalize(targetText);
  if (!needle || haystack.length !== targetText.length) return null;
  const expected = (from.range[0] / Math.max(1, from.text.length)) * targetText.length;
  let best: Range | null = null;
  let bestDistance = Infinity;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + 1)) {
    const distance = Math.abs(i - expected);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = [i, i + needle.length];
    }
  }
  return best;
}

/** Barcha bo'laklar uchun taklif; birortasi topilmasa — null. */
export function suggestRanges(fromText: string, ranges: Range[] | undefined, lang: "uz" | "cyrl", targetText: string): Range[] | null {
  if (!ranges?.length) return null;
  const out: Range[] = [];
  for (const range of ranges) {
    const r = suggestRange({ text: fromText, range, lang }, targetText);
    if (!r) return null;
    out.push(r);
  }
  return rangesValid(targetText, out) ? out : null;
}

/**
 * DOM tanlovidan (Selection) `root` ichidagi matn ofsetlari. Root ichida
 * faqat matn va <mark> bo'lishi kerak — matn tugunlari uzunliklari yig'iladi.
 */
export function selectionOffsets(root: Node, selection: { anchorNode: Node | null; anchorOffset: number; focusNode: Node | null; focusOffset: number }): Range | null {
  const { anchorNode, focusNode } = selection;
  if (!anchorNode || !focusNode || !root.contains(anchorNode) || !root.contains(focusNode)) return null;
  const offsetOf = (node: Node, offset: number): number | null => {
    let total = 0;
    const walk = (current: Node): boolean => {
      if (current === node) {
        if (current.nodeType === 3) total += offset;
        else for (let i = 0; i < offset && i < current.childNodes.length; i++) total += current.childNodes[i].textContent?.length ?? 0;
        return true;
      }
      if (current.nodeType === 3) {
        total += current.textContent?.length ?? 0;
        return false;
      }
      for (const child of Array.from(current.childNodes)) if (walk(child)) return true;
      return false;
    };
    return walk(root) ? total : null;
  };
  const a = offsetOf(anchorNode, selection.anchorOffset);
  const b = offsetOf(focusNode, selection.focusOffset);
  if (a === null || b === null || a === b) return null;
  return a < b ? [a, b] : [b, a];
}
