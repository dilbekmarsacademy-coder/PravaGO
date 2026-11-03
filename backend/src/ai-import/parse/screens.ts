// "Ekran rasmi" fayllari: har bir savol imtihon dasturining ekran rasmi (savol, variantlar,
// yashil belgilangan javob va rasm), matnda esa faqat qisqa javoblar ro'yxati
// ("1.тротуарда 2.А ва Б 3.усули ..."). Savollarni AI rasmdan o'qiydi (stageScreens);
// bu yerda — AI'siz qismi: aniqlash, rasm tartibi, javoblar ro'yxati va bilet raqami.

import type { ExtractedStructure } from "./structure";
import type { Line } from "./types";

/** Kamida shuncha rasm bo'lsa va matnli savollar rasmlarning yarmidan kam bo'lsa — ekran rasmlari. */
export const MIN_SCREENS = 3;

const TICKET_RE = /(\d{1,3})\s*[-–.]?\s*(?:билет|bilet)(?![\p{L}])/iu;

/** Hujjat tartibidagi rasm havolalari (takrorlarsiz). */
export function documentImageRefs(lines: Line[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) for (const img of l.images) if (!seen.has(img.ref)) seen.add(img.ref), out.push(img.ref);
  return out;
}

export function looksLikeScreens(structure: ExtractedStructure, imageCount: number): boolean {
  return imageCount >= MIN_SCREENS && structure.questions.length < imageCount / 2;
}

/** "4. билет", "4-bilet" → 4. */
export function ticketNumber(text: string): number | null {
  const m = text.match(TICKET_RE);
  return m ? Number(m[1]) : null;
}

/**
 * Raqamlangan qisqa javoblar: "1.тротуарда2.А ва Б", "9.4м10.тақиқланади", "15,яшил".
 * Raqamlar ketma-ket qidiriladi (1, 2, 3 ...), shuning uchun javob ichidagi son
 * ("9.4м") keyingi raqam deb olinmaydi. Bilet sarlavhasi qatori o'tkazib yuboriladi.
 */
export function numberedAnswers(lines: Line[], max = 100): Map<number, string> {
  const text = lines
    .map((l) => l.text)
    .filter((t) => !TICKET_RE.test(t) || t.replace(TICKET_RE, "").trim().length > 3)
    .join("\n");
  const marks: { n: number; start: number; end: number }[] = [];
  let pos = 0;
  const find = (n: number) => {
    const re = new RegExp(`(?<!\\d)${n}\\s*[.,)]\\s*`, "gu");
    re.lastIndex = pos;
    return re.exec(text);
  };
  for (let n = 1; n <= max; n++) {
    // Tushib qolgan raqam (1–2 ta) bo'lsa, keyingisidan davom etamiz.
    let m = find(n);
    for (let skip = 1; !m && skip <= 2; skip++) if ((m = find(n + skip))) n += skip;
    if (!m) break;
    marks.push({ n, start: m.index, end: m.index + m[0].length });
    pos = m.index + m[0].length;
  }
  const out = new Map<number, string>();
  marks.forEach((m, i) => {
    const answer = text
      .slice(m.end, marks[i + 1]?.start ?? text.length)
      .replace(/\s+/g, " ")
      .trim();
    if (answer) out.set(m.n, answer);
  });
  return out;
}
