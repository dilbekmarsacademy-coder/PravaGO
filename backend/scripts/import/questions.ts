// DOCX paragraflaridan savollarni ajratadi.
//
//   "N-савол. Матн" yoki "N. Матн" — savol boshi (matn keyingi paragrafda ham
//   kelishi mumkin; "N-савол" faylida keyingi raqamli "N. Матн" ham savol boshi);
//   raqamsiz faylda — variantlardan keyingi birinchi matnli paragraf;
//   "F1 — ...", "F2 — ..." yoki tiresiz "F1  ..." — variantlar (bitta paragrafga
//   yopishgan bo'lishi ham mumkin); "Kalit so'z(i): ..." — docx kalit so'zi.
//   To'g'ri javob — QALIN variant.

import type { DocxParagraph } from "./docx";
import { collapseSpaces } from "./text";

export interface ParsedOption {
  number: number;
  text: string;
  labelBold: boolean;
  /** Variant matnidagi harflarning qancha qismi qalin (0..1). */
  textBoldRatio: number;
}

export interface ParsedQuestion {
  number: number;
  text: string;
  imageRids: string[];
  options: ParsedOption[];
  docxKeyword: string | null;
  explanation: string | null;
  /** Variantlar orasida/keyin kelgan, savolga bog'lanmagan rasmlar. */
  strayImageRids: string[];
}

export interface ParsedDocx {
  title: string;
  declaredCount: number | null;
  questions: ParsedQuestion[];
  /** Birinchi savoldan oldingi rasmlar va boshqa e'tibor talab qiladigan holatlar. */
  warnings: string[];
}

const SAVOL_HEADER = /^\s*(\d{1,3})\s*-\s*савол(?![\p{L}])\s*[.:]?\s*/iu;
// "30.Тартибга ..." — nuqtadan keyin bo'shliq bo'lmasligi ham mumkin.
const DOT_HEADER = /^\s*(\d{1,3})\.(?!\d)\s*/u;
const DECLARED = /(\d+)\s*та\s+тест/iu;
const KEYWORD_LINE = /^\s*kalit\s+so\S*\s*:\s*(.*)$/iu;
const SEPARATOR = /^[\s─━—_\-–=]*$/u;
// "F1 — ..." yoki tiresiz "F1  ..." (faqat qator boshida yoki bo'shliqdan keyin).
const OPTION_MARKER = /F\s*(\d{1,2})\s*[—–-]\s*|(?<=^|\s)F(\d{1,2})\s+(?=\S)/gu;

interface Segment {
  text: string;
  bold: boolean[];
  images: { pos: number; rid: string }[];
}

function slice(p: Segment, start: number, end: number = p.text.length): Segment {
  return {
    text: p.text.slice(start, end),
    bold: p.bold.slice(start, end),
    images: p.images.filter((img) => img.pos >= start && img.pos <= end && (img.pos < end || end === p.text.length)).map((img) => ({ pos: img.pos - start, rid: img.rid })),
  };
}

function boldRatio(seg: Segment): number {
  let letters = 0;
  let bold = 0;
  for (let i = 0; i < seg.text.length; i++) {
    if (!/[\p{L}\p{N}]/u.test(seg.text[i])) continue;
    letters++;
    if (seg.bold[i]) bold++;
  }
  return letters === 0 ? 0 : bold / letters;
}

/** Variant belgilari: F1, F2, ... ketma-ket bo'lishi shart (tasodifiy "F" larni o'tkazib yuborish uchun). */
function findMarkers(text: string, expectedFirst: number): { start: number; end: number; number: number }[] {
  const markers: { start: number; end: number; number: number }[] = [];
  let expected = expectedFirst;
  for (const m of text.matchAll(OPTION_MARKER)) {
    const number = Number(m[1] ?? m[2]);
    if (number !== expected) continue;
    markers.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, number });
    expected++;
  }
  return markers;
}

export function parseQuestions(paragraphs: DocxParagraph[]): ParsedDocx {
  const warnings: string[] = [];
  const nonEmpty = paragraphs.filter((p) => p.text.trim() || p.images.length);
  const titleIndex = nonEmpty.findIndex((p) => p.text.trim());
  const title = titleIndex >= 0 ? collapseSpaces(nonEmpty[titleIndex].text) : "";
  const body = nonEmpty.slice(titleIndex + 1);
  // Fayl "N-савол" uslubida bo'lsa, "N." bilan boshlangan qatorlar savol emas.
  const useSavol = body.some((p) => SAVOL_HEADER.test(p.text));
  const header = useSavol ? SAVOL_HEADER : DOT_HEADER;
  // Savol raqamlari umuman yo'q — har bir savol variantlardan keyingi matn bilan boshlanadi.
  const unnumbered = !useSavol && !body.some((p) => DOT_HEADER.test(p.text));

  let declaredCount: number | null = null;
  const questions: ParsedQuestion[] = [];
  let current: ParsedQuestion | null = null;
  const questionText: string[] = [];
  const explanation: string[] = [];

  const finish = () => {
    if (!current) return;
    current.text = collapseSpaces(questionText.join(" "));
    current.explanation = explanation.length ? collapseSpaces(explanation.join(" ")) : null;
    questions.push(current);
    current = null;
    questionText.length = 0;
    explanation.length = 0;
  };

  for (const paragraph of body) {
    const trimmed = paragraph.text.trim();
    if (!current && DECLARED.test(trimmed)) {
      declaredCount = Number(DECLARED.exec(trimmed)?.[1]);
      continue;
    }
    if (!paragraph.images.length && SEPARATOR.test(trimmed)) continue;

    const keyword = KEYWORD_LINE.exec(trimmed);
    if (keyword) {
      if (current) current.docxKeyword = collapseSpaces(keyword[1]);
      else warnings.push(`Savoldan oldin kalit so'z qatori: "${trimmed}"`);
      continue;
    }

    let seg: Segment = paragraph;
    let head = header.exec(paragraph.text);
    // "N-савол" faylida ketma-ket keyingi raqamli "N. Матн" ham savol boshi.
    const lastNumber: number = (current as ParsedQuestion | null)?.number ?? questions.at(-1)?.number ?? 0;
    if (!head && useSavol) {
      const dot = DOT_HEADER.exec(paragraph.text);
      if (dot && Number(dot[1]) === lastNumber + 1) {
        head = dot;
        warnings.push(`${dot[1]}-savol "${dot[1]}." ko'rinishida yozilgan (boshqalari "N-савол")`);
      }
    }
    let number = head ? Number(head[1]) : null;
    if (!head && unnumbered && trimmed && (!current || current.options.length > 0) && !findMarkers(paragraph.text, ((current as ParsedQuestion | null)?.options.length ?? 0) + 1).some((m) => m.start === 0)) {
      head = /^/.exec(paragraph.text);
      number = lastNumber + 1;
    }
    if (head && number !== null) {
      finish();
      current = {
        number,
        text: "",
        imageRids: [],
        options: [],
        docxKeyword: null,
        explanation: null,
        strayImageRids: [],
      };
      seg = slice(paragraph, head[0].length);
    }

    if (!current) {
      if (paragraph.images.length) warnings.push(`Birinchi savoldan oldin ${paragraph.images.length} ta rasm (o'tkazib yuborildi)`);
      continue;
    }
    const q: ParsedQuestion = current;

    const markers = findMarkers(seg.text, q.options.length + 1);
    const prefix = slice(seg, 0, markers.length ? markers[0].start : seg.text.length);
    const prefixText = collapseSpaces(prefix.text);
    if (q.options.length === 0) {
      if (prefixText) questionText.push(prefixText);
      q.imageRids.push(...prefix.images.map((img) => img.rid));
    } else {
      if (prefixText) explanation.push(prefixText);
      q.strayImageRids.push(...prefix.images.map((img) => img.rid));
    }

    markers.forEach((marker, i) => {
      const label = slice(seg, marker.start, marker.end);
      const body = slice(seg, marker.end, markers[i + 1]?.start ?? seg.text.length);
      // "F1" belgisiga yopishib turgan rasm — birinchi variantdan oldin bo'lsa, savolniki.
      const labelImages = label.images.map((img) => img.rid);
      if (i === 0 && q.options.length === 0) q.imageRids.push(...labelImages);
      else q.strayImageRids.push(...labelImages);
      const labelBold = [...label.text].every((ch, k) => !/[\p{L}\p{N}]/u.test(ch) || label.bold[k]);
      q.strayImageRids.push(...body.images.map((img) => img.rid));
      q.options.push({
        number: marker.number,
        text: collapseSpaces(body.text),
        labelBold,
        textBoldRatio: boldRatio(body),
      });
    });
  }
  finish();

  return { title, declaredCount, questions, warnings };
}

export type CorrectResult =
  | { ok: true; index: number; basis: "text" | "label" }
  | { ok: false; reason: "no-bold" | "multiple-bold" | "all-bold"; boldNumbers: number[] };

const TEXT_BOLD_THRESHOLD = 0.6;

/**
 * Qalin variantni topadi. Avval variant matni bo'yicha, u farqlamasa (hammasi
 * qalin yoki hech biri) — "F<n> —" belgisi bo'yicha. Ba'zi fayllarda paragraf
 * uslubining o'zi qalin bo'ladi, shuning uchun variantlar bir-biri bilan
 * solishtiriladi: aynan bittasi ajralib turishi kerak.
 */
export function findCorrectOption(options: ParsedOption[]): CorrectResult {
  const n = options.length;
  const byText = options.flatMap((o, i) => (o.textBoldRatio >= TEXT_BOLD_THRESHOLD ? [i] : []));
  if (byText.length === 1) return { ok: true, index: byText[0], basis: "text" };
  if (byText.length > 1 && byText.length < n) {
    return { ok: false, reason: "multiple-bold", boldNumbers: byText.map((i) => options[i].number) };
  }
  const byLabel = options.flatMap((o, i) => (o.labelBold ? [i] : []));
  if (byLabel.length === 1) return { ok: true, index: byLabel[0], basis: "label" };
  if (byText.length === n || byLabel.length === n) {
    return { ok: false, reason: "all-bold", boldNumbers: options.map((o) => o.number) };
  }
  if (byLabel.length > 1) return { ok: false, reason: "multiple-bold", boldNumbers: byLabel.map((i) => options[i].number) };
  return { ok: false, reason: "no-bold", boldNumbers: [] };
}
