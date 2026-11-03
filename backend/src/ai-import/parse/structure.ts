// Qatorlardan (docx/html/pdf/txt) tuzilma: sarlavhalar (kun, mavzu), savollar, variantlar,
// rasmlar, to'g'ri javob, kalit so'zlar, izohlar, javoblar jadvali. AI'siz, deterministik.
//
// To'g'ri javobni aniqlash (ustuvorlik tartibida):
//   1) variant yonidagi belgi: ✓ ✔ ☑ * + (+);
//   2) savol ostidagi qator: "To'g'ri javob: F2", "Javob: ...", "Ответ: ...";
//   3) formatlash: highlight/fon → rang → qalin. Faqat BITTA variant belgilangan bo'lsa;
//      barcha variantlar (yoki butun matn) bir xil formatda bo'lsa — bu belgi hisoblanmaydi;
//   4) fayldagi javoblar jadvali yoki ro'yxati (1–F2, 2–F1 ...).

import { cleanText, normalizeForMatch, textSimilarity } from "../normalize";
import { F_BOLD, F_COLOR, F_HIGHLIGHT, type KeyCard, type Line } from "./types";

export type CorrectBy = "symbol" | "line" | "highlight" | "color" | "bold" | "table";

export interface Heading {
  day: number | null;
  topicNumber: number | null;
  title: string | null;
  raw: string;
}

export interface ExtractedQuestion {
  /** Manbadagi raqam (bo'lmasa null). */
  number: number | null;
  text: string;
  options: string[];
  correctIndex: number | null;
  correctBy: CorrectBy | null;
  imageRefs: string[];
  day: number | null;
  topicNumber: number | null;
  topicTitle: string | null;
  questionKey: string | null;
  answerKey: string | null;
  explanation: string | null;
  /** Bir nechta variant belgilangan, hammasi belgilangan va h.k. */
  notes: string[];
  /** Manbalar bir-biriga zid (masalan, ekrandagi yashil javob va matndagi javob) — tekshirish kerak. */
  doubt?: string | null;
}

export interface AnswerKeyEntry {
  number: number;
  optionIndex: number | null;
  answerText: string | null;
  day: number | null;
  topicNumber: number | null;
}

/** Kalit so'z / javob yozuvi (savolning o'zi boshqa faylda bo'lishi mumkin). */
export interface KeywordEntry {
  number: number | null;
  questionText: string | null;
  answerText: string | null;
  questionKey: string | null;
  answerKey: string | null;
  day: number | null;
  topicNumber: number | null;
}

export interface ExtractedStructure {
  headings: Heading[];
  questions: ExtractedQuestion[];
  answerKeys: AnswerKeyEntry[];
  keywords: KeywordEntry[];
}

const SAVOL_HEADER = /^\s*(\d{1,3})\s*[-–]?\s*(?:савол|savol|вопрос)\s*[.:)\-–—]?\s*/iu;
const DOT_HEADER = /^\s*(\d{1,3})\s*[.)](?!\d)\s*/u;
// `\b` kirill harflarida ishlamaydi — o'rniga harf emasligini tekshiramiz.
const DAY_RE = /(\d{1,2})\s*[-–]?\s*(?:kun|кун|день)(?![\p{L}])/iu;
const TOPIC_RE = /(\d{1,3})\s*[-–]?\s*(?:mavzu|мавзу|тема)(?:si|си)?(?![\p{L}])/iu;
const CORRECT_LINE = /^\s*(?:to['ʻ’`‘]?g['ʻ’`‘]?ri\s+javob(?:i)?|тўғри\s+жавоб(?:и)?|тугри\s+жавоб|правильный\s+ответ|javob|жавоб|ответ)\s*[:\-–—]\s*(.+)$/iu;
const SAVOL_KEY = /^\s*(?:savol\s+kalit(?:i|i so\S*)?|савол\s+калит(?:и)?)\s*[:\-–—]\s*(.+)$/iu;
const JAVOB_KEY = /^\s*(?:javob\s+kalit(?:i)?|жавоб\s+калит(?:и)?)\s*[:\-–—]\s*(.+)$/iu;
const KALIT = /^\s*(?:kalit\s+so\S*|калит\s+сўз\S*|калит\s+соз\S*|kalit|калит|ключевое\s+слово)\s*[:\-–—]\s*(.+)$/iu;
const EXPLANATION = /^\s*(?:izoh|изоҳ|изох|tushuntirish|тушунтириш|пояснение|объяснение)\s*[:\-–—]\s*(.+)$/iu;
const ARROW = /^(.{2,80}?)\s*(?:→|->|=>|—>|➔|⟶)\s*(.{2,80})$/u;
const ANSWERS_HEADER = /^\s*(?:to['ʻ’`‘]?g['ʻ’`‘]?ri\s+)?(?:javoblar|жавоблар|ответы|правильные\s+ответы|javob\s+kalitlari|жавоб\s+калитлари)(?![\p{L}])/iu;
const ANSWER_PAIR = /(\d{1,3})\s*[-–—.)=:]\s*(?:F\s*)?([1-6]|[A-FА-Е])(?![\p{L}\d])/gu;
const SYMBOL = /^\s*(?:\(\+\)|[✓✔☑]|\*|\+)\s*|\s*(?:\(\+\)|[✓✔☑]|\*|\+)\s*$/u;
const OPTION_MARKER = /(?:^|\s)F\s*(\d)\s*[—–\-.:)]?\s+|(?:^|\s)F\s*(\d)\s*[—–\-.:)]\s*/gu;
const LETTER_OPTION = /^\s*([A-FА-Е])\s*[).]\s+/u;

const LETTER_INDEX: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, А: 0, Б: 1, В: 2, Г: 3, Д: 4, Е: 5 };

function optionIndexFromToken(token: string): number | null {
  const t = token.trim().toUpperCase();
  if (/^[1-6]$/.test(t)) return Number(t) - 1;
  if (t in LETTER_INDEX) return LETTER_INDEX[t];
  return null;
}

interface Segment {
  text: string;
  flags: number[];
}

function seg(line: Line, start = 0, end = line.text.length): Segment {
  return { text: line.text.slice(start, end), flags: line.flags.slice(start, end) };
}

/** Matndagi harflarning qancha qismida `flag` bor (0..1). */
function ratio(s: Segment, flag: number): number {
  let letters = 0;
  let marked = 0;
  for (let i = 0; i < s.text.length; i++) {
    if (!/[\p{L}\p{N}]/u.test(s.text[i])) continue;
    letters++;
    if (s.flags[i] & flag) marked++;
  }
  return letters ? marked / letters : 0;
}

/** Qatordagi variantlar: "F1 — ...", "F2 ..." (bitta qatorda bir nechtasi ham) yoki "A) ...". */
function splitOptions(line: Line): { index: number; segment: Segment }[] | null {
  const markers: { start: number; end: number; index: number }[] = [];
  let expected: number | null = null;
  for (const m of line.text.matchAll(OPTION_MARKER)) {
    const n = Number(m[1] ?? m[2]);
    if (expected !== null && n !== expected) continue;
    const start = (m.index ?? 0) + (m[0].startsWith(" ") ? 1 : 0);
    markers.push({ start, end: (m.index ?? 0) + m[0].length, index: n - 1 });
    expected = n + 1;
  }
  if (markers.length && line.text.slice(0, markers[0].start).trim() === "") {
    return markers.map((mk, i) => ({ index: mk.index, segment: seg(line, mk.end, i + 1 < markers.length ? markers[i + 1].start : line.text.length) }));
  }
  const letter = LETTER_OPTION.exec(line.text);
  if (letter) return [{ index: LETTER_INDEX[letter[1].toUpperCase()], segment: seg(line, letter[0].length) }];
  return null;
}

/** Qator faqat javob juftlaridan iboratmi ("1–F2, 2–F1; 3-3"). */
function answerPairs(text: string): { number: number; index: number }[] | null {
  const pairs = [...text.matchAll(ANSWER_PAIR)].map((m) => ({ number: Number(m[1]), index: optionIndexFromToken(m[2]) ?? -1 }));
  if (!pairs.length) return null;
  const rest = text.replace(ANSWER_PAIR, "").replace(/[\s,;|/]+/g, "");
  return rest.length <= 3 ? pairs.filter((p) => p.index >= 0) : null;
}

function parseHeading(line: Line): Heading | null {
  const text = cleanText(line.text);
  if (text.length > 160 || SAVOL_HEADER.test(text)) return null;
  const day = DAY_RE.exec(text);
  const topic = TOPIC_RE.exec(text);
  if (!day && !topic) return null;
  // "1-kun" yoki "3-мавзу" qator boshida (yoki sarlavha uslubida) bo'lishi kerak.
  const first = Math.min(day?.index ?? Infinity, topic?.index ?? Infinity);
  if (first > 12 && !line.heading) return null;
  const after = topic ? text.slice((topic.index ?? 0) + topic[0].length) : day ? text.slice((day.index ?? 0) + day[0].length) : "";
  const title = cleanText(after.replace(/^[\s:.\-–—|«"“]+/u, "").replace(/[»"”]+$/u, "")) || null;
  return { day: day ? Number(day[1]) : null, topicNumber: topic ? Number(topic[1]) : null, title, raw: text };
}

function stripSymbol(text: string): { text: string; marked: boolean } {
  const marked = SYMBOL.test(text) && cleanText(text.replace(SYMBOL, "")).length > 0;
  return { text: marked ? text.replace(SYMBOL, "") : text, marked };
}

interface Draft {
  number: number | null;
  text: Segment;
  options: { index: number; segment: Segment; symbol: boolean }[];
  imageRefs: string[];
  strayImages: string[];
  correctLine: string | null;
  questionKey: string | null;
  answerKey: string | null;
  explanation: string | null;
  heading: Heading;
}

function decideCorrect(d: Draft): { index: number | null; by: CorrectBy | null; notes: string[] } {
  const notes: string[] = [];
  const options = d.options;
  if (!options.length) return { index: null, by: null, notes };
  const symbols = options.map((o, i) => (o.symbol ? i : -1)).filter((i) => i >= 0);
  if (symbols.length === 1) return { index: symbols[0], by: "symbol", notes };
  if (symbols.length > 1) notes.push(`${symbols.length} ta variant belgi bilan belgilangan`);

  if (d.correctLine) {
    const value = d.correctLine.trim();
    const token = /^(?:F\s*)?([1-6]|[A-FА-Е])(?![\p{L}\d])/iu.exec(value);
    const byToken = token ? optionIndexFromToken(token[1]) : null;
    if (byToken !== null && byToken < options.length) return { index: byToken, by: "line", notes };
    // Javob matn bilan yozilgan — eng o'xshash variant.
    const scored = options.map((o, i) => ({ i, s: textSimilarity(o.segment.text, value) })).sort((a, b) => b.s - a.s);
    if (scored[0] && scored[0].s >= 0.75 && (!scored[1] || scored[0].s - scored[1].s > 0.1)) return { index: scored[0].i, by: "line", notes };
    notes.push(`"Javob" qatori variantlarga mos kelmadi: ${value.slice(0, 80)}`);
  }

  for (const [flag, by] of [
    [F_HIGHLIGHT, "highlight"],
    [F_COLOR, "color"],
    [F_BOLD, "bold"],
  ] as const) {
    const marked = options.map((o, i) => (ratio(o.segment, flag) >= 0.6 ? i : -1)).filter((i) => i >= 0);
    if (marked.length === 1) return { index: marked[0], by, notes };
    if (marked.length > 1 && marked.length < options.length) notes.push(`${marked.length} ta variant ${by === "bold" ? "qalin" : by === "color" ? "rangli" : "highlight"}`);
  }
  return { index: null, by: null, notes };
}

/**
 * Qatorlar → tuzilma. `defaults` — fayl nomi yoki admin tanlagan kun/mavzu
 * (fayl ichida sarlavha bo'lmasa ishlatiladi).
 */
export function parseStructure(lines: Line[], defaults: { day?: number | null; topicNumber?: number | null; title?: string | null } = {}, cards?: KeyCard[]): ExtractedStructure {
  const headings: Heading[] = [];
  const questions: ExtractedQuestion[] = [];
  const answerKeys: AnswerKeyEntry[] = [];
  const keywords: KeywordEntry[] = [];
  const useSavol = lines.some((l) => SAVOL_HEADER.test(l.text));
  const header = useSavol ? SAVOL_HEADER : DOT_HEADER;

  let heading: Heading = { day: defaults.day ?? null, topicNumber: defaults.topicNumber ?? null, title: defaults.title ?? null, raw: "" };
  let q: Draft | null = null;
  let answersSection = false;
  let pendingImages: string[] = [];
  /** Variantsiz yozuv (kalit/javob fayli) — keyingi qatorlar shu yozuvga. */
  let entry: KeywordEntry | null = null;

  const finish = () => {
    if (!q) return;
    const d = q;
    q = null;
    const text = cleanText(d.text.text);
    if (!d.options.length) {
      // Variantsiz — kalit/javob yozuvi (savolning o'zi boshqa faylda).
      if (text || d.questionKey || d.answerKey || d.correctLine) {
        keywords.push({
          number: d.number,
          questionText: text || null,
          answerText: d.correctLine ? cleanText(d.correctLine) : null,
          questionKey: d.questionKey,
          answerKey: d.answerKey,
          day: d.heading.day,
          topicNumber: d.heading.topicNumber,
        });
      }
      pendingImages.push(...d.imageRefs);
      return;
    }
    const correct = decideCorrect(d);
    const ordered = [...d.options].sort((a, b) => a.index - b.index);
    questions.push({
      number: d.number,
      text,
      options: ordered.map((o) => cleanText(stripSymbol(o.segment.text).text)),
      correctIndex: correct.index === null ? null : ordered.findIndex((o) => o.index === d.options[correct.index!].index),
      correctBy: correct.by,
      imageRefs: d.imageRefs.length ? d.imageRefs : d.strayImages,
      day: d.heading.day,
      topicNumber: d.heading.topicNumber,
      topicTitle: d.heading.title,
      questionKey: d.questionKey,
      answerKey: d.answerKey,
      explanation: d.explanation,
      notes: correct.notes,
    });
  };

  const start = (number: number | null, text: Segment, images: string[]) => {
    finish();
    entry = null;
    q = { number, text, options: [], imageRefs: [...pendingImages, ...images], strayImages: [], correctLine: null, questionKey: null, answerKey: null, explanation: null, heading };
    pendingImages = [];
  };

  // `q` yopilmalar (finish/start) ichida o'zgaradi — TS uni toraytirib yubormasligi uchun funksiya orqali.
  const current = (): Draft | null => q;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text;
    const images = line.images.map((im) => im.ref);
    const trimmed = text.trim();

    if (ANSWERS_HEADER.test(trimmed) && trimmed.length < 60) {
      finish();
      answersSection = true;
      const pairs = answerPairs(trimmed.replace(ANSWERS_HEADER, "").replace(/^[\s:.-]+/, ""));
      for (const p of pairs ?? []) answerKeys.push({ number: p.number, optionIndex: p.index, answerText: null, day: heading.day, topicNumber: heading.topicNumber });
      continue;
    }

    const h = trimmed ? parseHeading(line) : null;
    if (h) {
      finish();
      answersSection = false;
      heading = {
        day: h.day ?? (h.topicNumber !== null ? heading.day : null),
        topicNumber: h.topicNumber,
        title: h.title,
        raw: h.raw,
      };
      headings.push(heading);
      continue;
    }

    const pairs = trimmed ? answerPairs(trimmed) : null;
    if (pairs && (answersSection || pairs.length >= 2)) {
      finish();
      for (const p of pairs) answerKeys.push({ number: p.number, optionIndex: p.index, answerText: null, day: heading.day, topicNumber: heading.topicNumber });
      continue;
    }

    const target = current();
    const correctM = CORRECT_LINE.exec(trimmed);
    const sKey = SAVOL_KEY.exec(trimmed);
    const jKey = JAVOB_KEY.exec(trimmed);
    const kalit = KALIT.exec(trimmed);
    const expl = EXPLANATION.exec(trimmed);
    if (correctM || sKey || jKey || kalit || expl) {
      if (target) {
        if (correctM) target.correctLine = correctM[1];
        if (sKey) target.questionKey = cleanText(sKey[1]);
        if (jKey) target.answerKey = cleanText(jKey[1]);
        if (kalit) {
          const arrow = ARROW.exec(cleanText(kalit[1]));
          if (arrow) {
            target.questionKey = cleanText(arrow[1]);
            target.answerKey = cleanText(arrow[2]);
          } else target.answerKey ??= cleanText(kalit[1]);
        }
        if (expl) target.explanation = cleanText(expl[1]);
      }
      continue;
    }

    const arrow = !answersSection && trimmed.length < 170 ? ARROW.exec(trimmed) : null;
    if (arrow && target && !splitOptions(line)) {
      target.questionKey = cleanText(arrow[1].replace(header, ""));
      target.answerKey = cleanText(arrow[2]);
      continue;
    }

    const opts = splitOptions(line);
    if (opts && target) {
      for (const o of opts) {
        const { marked } = stripSymbol(o.segment.text);
        target.options.push({ index: o.index, segment: o.segment, symbol: marked });
      }
      if (images.length) target.strayImages.push(...images);
      continue;
    }

    const hm = header.exec(text);
    if (hm && trimmed.length > hm[0].trim().length) {
      start(Number(hm[1]), seg(line, hm[0].length), images);
      continue;
    }
    if (hm) {
      // Faqat raqam ("12-савол") — matn keyingi qatorda.
      start(Number(hm[1]), { text: "", flags: [] }, images);
      continue;
    }

    if (!trimmed) {
      if (target && !target.options.length) target.imageRefs.push(...images);
      else if (target) target.strayImages.push(...images);
      else pendingImages.push(...images);
      continue;
    }

    if (target && !target.options.length) {
      // Savol matnining davomi.
      target.text = { text: `${target.text.text} ${text}`, flags: [...target.text.flags, 0, ...line.flags] };
      target.imageRefs.push(...images);
      continue;
    }

    // Raqamsiz savol: keyingi qator variant bo'lsa — yangi savol boshlanadi.
    const next = lines[i + 1];
    if (next && splitOptions(next)) {
      start(null, seg(line), images);
      continue;
    }
    if (target && target.options.length) {
      // Oxirgi variantning davomi.
      const last = target.options[target.options.length - 1];
      last.segment = { text: `${last.segment.text} ${text}`, flags: [...last.segment.flags, 0, ...line.flags] };
      continue;
    }
    void entry;
  }
  finish();

  // Kalit kartalari (HTML) — kalit yozuvlari.
  for (const card of cards ?? []) {
    keywords.push({
      number: card.number,
      questionText: card.question || null,
      answerText: card.answer || null,
      questionKey: card.questionKey || null,
      answerKey: card.answerKey || null,
      day: heading.day,
      topicNumber: heading.topicNumber,
    });
  }

  // Shu fayldagi javoblar jadvali — javobsiz savollarga (kun, mavzu va raqam bo'yicha).
  for (const question of questions) {
    if (question.correctIndex !== null || question.number === null) continue;
    const key = answerKeys.find(
      (k) => k.number === question.number && (k.topicNumber === null || k.topicNumber === question.topicNumber) && (k.day === null || k.day === question.day),
    );
    if (key?.optionIndex !== null && key?.optionIndex !== undefined && key.optionIndex < question.options.length) {
      question.correctIndex = key.optionIndex;
      question.correctBy = "table";
    }
  }
  return { headings, questions, answerKeys, keywords };
}

/** Fayl nomidan kun/mavzu ("2-kun_1-mavzu.docx", "day3-topic2.html"). */
export function headingFromFileName(name: string): { day: number | null; topicNumber: number | null } {
  const base = name.replace(/\.[a-z0-9]+$/i, "").replace(/[_]+/g, " ");
  const day = DAY_RE.exec(base) ?? /day\s*(\d{1,2})/i.exec(base);
  const topic = TOPIC_RE.exec(base) ?? /topic\s*(\d{1,3})/i.exec(base);
  return { day: day ? Number(day[1]) : null, topicNumber: topic ? Number(topic[1]) : null };
}

export { normalizeForMatch };
