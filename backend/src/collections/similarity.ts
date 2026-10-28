// Dublikat ogohlantiruvi: savol matnlarini (lotinga keltirilgan) so'z trigrammalari
// bo'yicha solishtirish — Dice koeffitsiyenti.

import { cyrillicToLatin } from "../common/translit";

export function normalizeForCompare(text: string): string {
  return cyrillicToLatin(text)
    .toLowerCase()
    .replace(/[‘’ʻʼ`']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function grams(text: string): Map<string, number> {
  const s = ` ${text} `;
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 2; i++) {
    const g = s.slice(i, i + 3);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

export function similarity(a: string, b: string): number {
  const ga = grams(normalizeForCompare(a));
  const gb = grams(normalizeForCompare(b));
  let overlap = 0;
  let total = 0;
  for (const [g, n] of ga) {
    overlap += Math.min(n, gb.get(g) ?? 0);
    total += n;
  }
  for (const n of gb.values()) total += n;
  return total ? (2 * overlap) / total : 0;
}
