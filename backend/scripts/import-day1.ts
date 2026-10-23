// 1-kun testlarini (7 mavzu) docx + kalit so'z HTML fayllaridan bazaga import qiladi.
//
//   npm run import:day1                — import (DATABASE_URL dagi bazaga)
//   npm run import:day1 -- --dry-run   — bazaga yozmaydi, faqat hisobot
//
// Manbalar (git'ga tushmaydi): <repo>/content-source/day1/docx/*.docx va
// <repo>/content-source/day1/keywords/*.html; ruscha tarjimalar —
// content-source/day1/ru/day1-topicN.json. Hisobot: content-source/day1/import-report.md.
//
// Qoidalar:
//  - test savoli, variantlar, rasm va TO'G'RI JAVOB — faqat docx'dan (qalin variant);
//  - kalit so'zlar — HTML'dan; mavzular va savollar raqam bo'yicha EMAS,
//    nomi/matni bo'yicha bog'lanadi;
//  - idempotent: mavzu slug'i + savol tartibi (va variant tartibi) bo'yicha upsert.

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { Prisma, PrismaClient } from "@prisma/client";
import { cyrillicToLatin, latinToCyrillic } from "../../src/lib/i18n/translit";
import { readDocx } from "./day1/docx";
import { parseKeywordsHtml, type HtmlCard } from "./day1/keywords-html";
import { findCorrectOption, parseQuestions, type ParsedQuestion } from "./day1/questions";
import {
  comparable,
  cyrillicToLatinMapped,
  findLatinInCyrillic,
  findWordsRange,
  normalize,
  similarity,
  type Range,
} from "./day1/text";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SOURCE_DIR = path.join(REPO_ROOT, "content-source", "day1");
const IMAGES_DIR = path.resolve(__dirname, "..", "prisma", "seed-data", "images");
const REPORT_PATH = path.join(SOURCE_DIR, "import-report.md");
const EXTRACT_DIR = path.join(SOURCE_DIR, "extracted");
const RU_DIR = path.join(SOURCE_DIR, "ru");
/** Qo'lda tekshiruv natijalari va boshqa izohlar — hisobot oxiriga qo'shiladi. */
const REPORT_NOTES_PATH = path.join(SOURCE_DIR, "report-notes.md");

const DRY_RUN = process.argv.includes("--dry-run");
const PAIR_THRESHOLD = 0.8;
/** Savol matni bo'yicha shu farq ichidagi nomzodlar "bir xil matnli" hisoblanadi. */
const AMBIGUITY_MARGIN = 0.05;
const IMAGE_MAX_SIDE = 1280;
const IMAGE_QUALITY = 80;

/** Eski (oldingi import) 2-mavzu banki — dublikat yaratmasdan shu mavzuga ko'chiriladi. */
const LEGACY_SLUGS: Record<string, string> = {
  "day1-topic2": "1-kun-2-mavzu-tartibga-soluvchining-ishoralari",
};

interface TopicDef {
  order: number;
  slug: string;
  /** Sayt sarlavhasi (src/data/curriculum.ts bilan bir xil). */
  title: { uz: string; cyrl: string; ru: string };
  /** Fayl sarlavhasida (transliteratsiya + normallashtirishdan keyin) bo'lishi shart bo'lgan bo'laklar. */
  must: string[];
  mustNot?: string[];
}

const TOPICS: TopicDef[] = [
  {
    order: 1,
    slug: "day1-topic1",
    title: { uz: "Svetofor ishoralari", cyrl: "Светофор ишоралари", ru: "Сигналы светофора" },
    must: ["svetofor ishoralari"],
  },
  {
    order: 2,
    slug: "day1-topic2",
    title: { uz: "Tartibga soluvchining ishoralari", cyrl: "Тартибга солувчининг ишоралари", ru: "Сигналы регулировщика" },
    must: ["tartibga soluvchining ishoralari"],
  },
  {
    order: 3,
    slug: "day1-topic3",
    title: { uz: "Chorrahalarda harakatlanish", cyrl: "Чорраҳаларда ҳаракатланиш", ru: "Движение через перекрёстки" },
    must: ["chorrahalarda harakatlanish"],
  },
  {
    order: 4,
    slug: "day1-topic4",
    title: { uz: "Tartibga solingan chorrahalar", cyrl: "Тартибга солинган чорраҳалар", ru: "Регулируемые перекрёстки" },
    must: ["tartibga solingan chorrahalar"],
  },
  {
    order: 5,
    slug: "day1-topic5",
    title: {
      uz: "Tartibga solinmagan chorrahalar: teng ahamiyatli yo'llar",
      cyrl: "Тартибга солинмаган чорраҳалар: тенг аҳамиятли йўллар",
      ru: "Нерегулируемые перекрёстки: равнозначные дороги",
    },
    must: ["tartibga solinmagan chorrahalar", "teng ahamiyatli"],
  },
  {
    order: 6,
    slug: "day1-topic6",
    title: {
      uz: "Tartibga solinmagan chorrahalar: asosiy yo'l yo'nalishi o'zgarishi",
      cyrl: "Тартибга солинмаган чорраҳалар: асосий йўл йўналиши ўзгариши",
      ru: "Нерегулируемые перекрёстки: изменение направления главной дороги",
    },
    must: ["tartibga solinmagan chorrahalar", "asosiy yol yonalishi", "ozgarishi"],
    mustNot: ["togrisi"],
  },
  {
    order: 7,
    slug: "day1-topic7",
    title: {
      uz: "Tartibga solinmagan chorrahalar: asosiy yo'l yo'nalishi o'zgarishi to'g'risi",
      cyrl: "Тартибга солинмаган чорраҳалар: асосий йўл йўналиши ўзгариши тўғриси",
      ru: "Нерегулируемые перекрёстки: изменение направления главной дороги (продолжение)",
    },
    must: ["tartibga solinmagan chorrahalar", "asosiy yol yonalishi", "togrisi"],
  },
];

function matchTopic(title: string): TopicDef[] {
  const t = comparable(title);
  return TOPICS.filter(
    (topic) => topic.must.every((part) => t.includes(normalize(part))) && !(topic.mustNot ?? []).some((part) => t.includes(normalize(part))),
  );
}

/** Ruscha tarjima fayli: savol tartibi → tarjima. */
interface RuEntry {
  text: string;
  options: Record<string, string>;
  explanation?: string;
  /** Ruscha savol matnidagi kalit so'z (aynan shu ko'rinishda matnda bo'lishi kerak). */
  questionKeyword?: string;
  /** Ruscha to'g'ri javob matnidagi kalit so'z. */
  answerKeyword?: string;
}

type LangRanges = { uz?: Range; cyrl?: Range; ru?: Range };

interface KeywordData {
  source: "html" | "docx" | "none";
  questionText: string | null;
  questionTextCyrl: string | null;
  questionTextRu: string | null;
  answerText: string | null;
  answerTextCyrl: string | null;
  answerTextRu: string | null;
  highlights: { question: LangRanges; answer: LangRanges };
  docxKeyword: string | null;
  needsReview: boolean;
}

interface ImportOption {
  order: number;
  text: string;
  textLatn: string;
  textRu: string | null;
  isCorrect: boolean;
}

interface ImportQuestion {
  order: number;
  text: string;
  textLatn: string;
  textRu: string | null;
  explanation: string | null;
  explanationLatn: string | null;
  explanationRu: string | null;
  image: { file: string; width: number; height: number } | null;
  options: ImportOption[];
  keywords: KeywordData;
  ruNeedsReview: boolean;
  pair: { card: HtmlCard; qSim: number; aSim: number } | null;
}

interface TopicResult {
  def: TopicDef;
  docxFile: string;
  htmlFile: string | null;
  docxTitle: string;
  htmlTitle: string | null;
  declaredCount: number | null;
  parsedCount: number;
  questions: ImportQuestion[];
  skipped: { number: number; reason: string }[];
  numbering: string[];
  warnings: string[];
  answerConflicts: { order: number; docx: string; html: string; sim: number; htmlMatchesOther: string | null }[];
  answerKeyMissing: { order: number; kAns: string; docx: string }[];
  questionKeyMissing: { order: number; kq: string }[];
  unpairedHtml: HtmlCard[];
  lowSimilarityPairs: { order: number; qSim: number; docx: string; html: string }[];
  /** Juftliksiz docx savoli uchun eng yaqin juftsiz HTML kartochka (chegaradan past). */
  nearMisses: { order: number; qSim: number; aSim: number; docx: string; html: string }[];
  approximate: string[];
  ruMissing: number[];
  ruKeywordReview: string[];
  imageCount: number;
}

function upperUz(text: string): string {
  return text.toLocaleUpperCase("uz");
}

function upperRu(text: string): string {
  return text.toLocaleUpperCase("ru");
}

async function convertImage(data: Buffer, file: string): Promise<{ width: number; height: number }> {
  const out = await sharp(data)
    .rotate()
    .resize({ width: IMAGE_MAX_SIDE, height: IMAGE_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: IMAGE_QUALITY })
    .toBuffer({ resolveWithObject: true });
  const target = path.join(IMAGES_DIR, file);
  if (!fs.existsSync(target) || !fs.readFileSync(target).equals(out.data)) fs.writeFileSync(target, out.data);
  return { width: out.info.width, height: out.info.height };
}

/** Docx savollari ↔ HTML kartochkalari: savol matni bo'yicha, bir xil matnlarda — javob ham. */
function pairQuestions(questions: { q: ParsedQuestion; correct: string }[], cards: HtmlCard[]) {
  const dq = questions.map(({ q }) => comparable(q.text));
  const da = questions.map(({ correct }) => comparable(correct));
  const hq = cards.map((c) => normalize(c.question));
  const ha = cards.map((c) => normalize(c.answer));
  const sims = dq.map((d) => hq.map((h) => (d && h ? similarity(d, h) : 0)));

  const candidates: { i: number; j: number; qSim: number; aSim: number }[] = [];
  for (let i = 0; i < questions.length; i++) {
    for (let j = 0; j < cards.length; j++) {
      const qSim = sims[i][j];
      if (qSim < PAIR_THRESHOLD) continue;
      const aSim = similarity(da[i], ha[j]);
      // Bir xil (yoki deyarli bir xil) matnli savollar bir nechta bo'lsa — javob ham mos kelishi shart.
      const near = (s: number) => s >= PAIR_THRESHOLD && s >= qSim - AMBIGUITY_MARGIN;
      const ambiguous = sims[i].filter(near).length > 1 || sims.filter((row) => near(row[j])).length > 1;
      if (ambiguous && aSim < PAIR_THRESHOLD) continue;
      candidates.push({ i, j, qSim, aSim });
    }
  }
  candidates.sort((a, b) => b.qSim + b.aSim * 0.5 - (a.qSim + a.aSim * 0.5));
  const byQuestion = new Map<number, { j: number; qSim: number; aSim: number }>();
  const usedCards = new Set<number>();
  for (const c of candidates) {
    if (byQuestion.has(c.i) || usedCards.has(c.j)) continue;
    byQuestion.set(c.i, { j: c.j, qSim: c.qSim, aSim: c.aSim });
    usedCards.add(c.j);
  }
  return { byQuestion, unpaired: cards.filter((_, j) => !usedCards.has(j)) };
}

function loadRu(slug: string): Record<string, RuEntry> {
  const file = path.join(RU_DIR, `${slug}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

async function processTopic(def: TopicDef, docxPath: string, htmlPath: string | null): Promise<TopicResult> {
  const docx = await readDocx(fs.readFileSync(docxPath));
  const parsed = parseQuestions(docx.paragraphs);
  const html = htmlPath ? parseKeywordsHtml(fs.readFileSync(htmlPath, "utf8")) : null;
  const ru = loadRu(def.slug);

  const result: TopicResult = {
    def,
    docxFile: path.basename(docxPath),
    htmlFile: htmlPath ? path.basename(htmlPath) : null,
    docxTitle: parsed.title,
    htmlTitle: html?.title ?? null,
    declaredCount: parsed.declaredCount,
    parsedCount: parsed.questions.length,
    questions: [],
    skipped: [],
    numbering: [],
    warnings: [...parsed.warnings],
    answerConflicts: [],
    answerKeyMissing: [],
    questionKeyMissing: [],
    unpairedHtml: [],
    lowSimilarityPairs: [],
    nearMisses: [],
    approximate: [],
    ruMissing: [],
    ruKeywordReview: [],
    imageCount: 0,
  };

  // Raqamlar ketma-ketligi va e'lon qilingan son.
  parsed.questions.forEach((q, i) => {
    if (q.number !== i + 1) result.numbering.push(`${i + 1}-o'rinda savol raqami ${q.number}`);
  });
  if (parsed.declaredCount !== null && parsed.declaredCount !== parsed.questions.length) {
    result.numbering.push(`Sarlavhada ${parsed.declaredCount} ta deyilgan, topilgani ${parsed.questions.length} ta`);
  }
  const numbersUnique = new Set(parsed.questions.map((q) => q.number)).size === parsed.questions.length;
  if (!numbersUnique) result.numbering.push("Savol raqamlari takrorlanadi — tartib raqami sifatida fayldagi o'rni olindi");

  // Validatsiya: ≥2 variant va aynan 1 ta qalin javob.
  const valid: { q: ParsedQuestion; order: number; correctIndex: number; correct: string }[] = [];
  parsed.questions.forEach((q, i) => {
    const order = numbersUnique ? q.number : i + 1;
    if (q.options.length < 2) {
      result.skipped.push({ number: q.number, reason: `variantlar soni ${q.options.length} (kamida 2 ta kerak)` });
      return;
    }
    const correct = findCorrectOption(q.options);
    if (!correct.ok) {
      const reason =
        correct.reason === "no-bold"
          ? "to'g'ri javob (qalin variant) belgilanmagan"
          : correct.reason === "all-bold"
            ? `barcha variantlar qalin (${correct.boldNumbers.map((n) => `F${n}`).join(", ")}) — to'g'ri javobni aniqlab bo'lmaydi`
            : `${correct.boldNumbers.length} ta variant qalin (${correct.boldNumbers.map((n) => `F${n}`).join(", ")})`;
      result.skipped.push({ number: q.number, reason });
      return;
    }
    if (q.imageRids.length > 1) result.warnings.push(`${q.number}-savol: ${q.imageRids.length} ta rasm — birinchisi olindi`);
    if (q.strayImageRids.length) result.warnings.push(`${q.number}-savol: variantlardan keyin ${q.strayImageRids.length} ta rasm (hech qaysi savolga bog'lanmadi)`);
    if (!q.text) result.warnings.push(`${q.number}-savol: savol matni bo'sh (faqat rasm)`);
    valid.push({ q, order, correctIndex: correct.index, correct: q.options[correct.index].text });
  });

  const { byQuestion, unpaired } = html ? pairQuestions(valid, html.cards) : { byQuestion: new Map(), unpaired: [] };
  result.unpairedHtml = unpaired;
  for (const [index, { q, order, correct }] of valid.entries()) {
    if (byQuestion.has(index) || !unpaired.length) continue;
    const best = unpaired
      .map((c) => ({ c, qSim: similarity(comparable(q.text), normalize(c.question)), aSim: similarity(comparable(correct), normalize(c.answer)) }))
      .sort((a, b) => b.qSim + b.aSim - (a.qSim + a.aSim))[0];
    if (best && best.qSim >= 0.4) {
      result.nearMisses.push({ order, qSim: best.qSim, aSim: best.aSim, docx: q.text, html: best.c.question });
    }
  }

  for (const [index, item] of valid.entries()) {
    const { q, order, correctIndex } = item;
    const pairInfo = byQuestion.get(index);
    const card = pairInfo && html ? html.cards[pairInfo.j] : null;
    const pair = card && pairInfo ? { card, qSim: pairInfo.qSim, aSim: pairInfo.aSim } : null;

    // Rasm
    let image: ImportQuestion["image"] = null;
    const rid = q.imageRids[0];
    if (rid) {
      const img = await docx.readImage(rid);
      if (!img) result.warnings.push(`${q.number}-savol: rasm fayli topilmadi (${rid})`);
      else {
        const file = `d1t${def.order}-q${String(order).padStart(2, "0")}.webp`;
        try {
          const size = await convertImage(img.data, file);
          image = { file, ...size };
          result.imageCount++;
        } catch (err) {
          result.warnings.push(`${q.number}-savol: rasmni o'girib bo'lmadi (${img.ext}): ${(err as Error).message}`);
        }
      }
    }

    // Matnlar: kirill — docx asli; lotin — HTML juftligi bo'lsa o'sha, aks holda transliteratsiya.
    const translit = (text: string) => {
      const mapped = cyrillicToLatinMapped(text).text;
      if (mapped !== cyrillicToLatin(text)) throw new Error(`Transliteratsiya frontend bilan mos emas: ${text}`);
      return mapped;
    };
    const textLatn = pair ? pair.card.question : translit(q.text);
    const ruEntry: RuEntry | undefined = ru[String(order)];
    if (!ruEntry) result.ruMissing.push(order);
    else if (Object.keys(ruEntry.options).length !== q.options.length || q.options.some((_, i) => !ruEntry.options[String(i + 1)])) {
      throw new Error(`${def.slug} ${order}-savol: ruscha variantlar soni docx bilan mos emas`);
    }

    const options: ImportOption[] = q.options.map((o, i) => ({
      order: i + 1,
      text: o.text,
      textLatn: translit(o.text),
      textRu: ruEntry?.options[String(i + 1)] ?? null,
      isCorrect: i === correctIndex,
    }));
    const correctOption = options[correctIndex];

    // Kalit so'zlar
    const keywords: KeywordData = {
      source: "none",
      questionText: null,
      questionTextCyrl: null,
      questionTextRu: null,
      answerText: null,
      answerTextCyrl: null,
      answerTextRu: null,
      highlights: { question: {}, answer: {} },
      docxKeyword: q.docxKeyword,
      needsReview: false,
    };

    if (pair) {
      const { card: c } = pair;
      keywords.source = "html";
      // Savol kaliti — savol matnidan olingan, doim bog'lanadi.
      if (c.questionMark || c.questionKeyword) {
        keywords.questionText = c.questionKeyword || upperUz(c.questionMark?.text ?? "");
        if (c.questionMark) {
          keywords.highlights.question.uz = c.questionMark.range;
          const found = findLatinInCyrillic(q.text, c.questionMark.text);
          if (found) {
            keywords.highlights.question.cyrl = found.range;
            keywords.questionTextCyrl = upperUz(q.text.slice(...found.range));
            if (found.approximate) {
              result.approximate.push(`${order}-savol, savol kaliti: "${c.questionMark.text}" ≈ "${q.text.slice(...found.range)}"`);
            }
          } else {
            keywords.questionTextCyrl = latinToCyrillic(keywords.questionText);
            keywords.needsReview = true;
            result.questionKeyMissing.push({ order, kq: c.questionMark.text });
          }
        } else {
          keywords.questionTextCyrl = latinToCyrillic(keywords.questionText);
        }
      }

      // Javob kaliti — faqat docx'dagi to'g'ri javob ichida uchrasa.
      const html = comparable(c.answer);
      const docxAnswer = comparable(correctOption.text);
      if (html !== docxAnswer) {
        const other = options.find((o) => !o.isCorrect && comparable(o.text) === html);
        result.answerConflicts.push({
          order,
          docx: correctOption.text,
          html: c.answer,
          sim: similarity(html, docxAnswer),
          htmlMatchesOther: other ? `F${other.order} — ${other.text}` : null,
        });
      }
      if (c.answerMark) {
        const latn = findWordsRange(correctOption.textLatn, c.answerMark.text);
        const cyrl = findLatinInCyrillic(correctOption.text, c.answerMark.text);
        if (latn && cyrl) {
          // Taxminiy moslikda chip docx javobidagi (belgilangan) bo'lakni ko'rsatadi — javob matni bilan bir xil.
          keywords.answerText = latn.approximate
            ? upperUz(correctOption.textLatn.slice(...latn.range))
            : c.answerKeyword || upperUz(c.answerMark.text);
          keywords.answerTextCyrl = upperUz(correctOption.text.slice(...cyrl.range));
          keywords.highlights.answer.uz = latn.range;
          keywords.highlights.answer.cyrl = cyrl.range;
          if (cyrl.approximate) {
            result.approximate.push(`${order}-savol, javob kaliti: "${c.answerMark.text}" ≈ "${correctOption.text.slice(...cyrl.range)}"`);
          }
        } else {
          result.answerKeyMissing.push({ order, kAns: c.answerMark.text, docx: correctOption.text });
        }
      }
      if (pair.qSim < 0.9) {
        result.lowSimilarityPairs.push({ order, qSim: pair.qSim, docx: q.text, html: c.question });
      }
    } else if (q.docxKeyword) {
      // HTML'da juftlik yo'q, lekin docx'da kalit so'z bor (2-mavzu) — javob kaliti sifatida.
      const latinKeyword = /[Ѐ-ӿ]/.test(q.docxKeyword) ? cyrillicToLatin(q.docxKeyword) : q.docxKeyword;
      const latn = findWordsRange(correctOption.textLatn, latinKeyword);
      const cyrl = findLatinInCyrillic(correctOption.text, latinKeyword);
      if (latn && cyrl) {
        keywords.source = "docx";
        keywords.answerText = upperUz(latinKeyword);
        keywords.answerTextCyrl = upperUz(correctOption.text.slice(...cyrl.range));
        keywords.highlights.answer.uz = latn.range;
        keywords.highlights.answer.cyrl = cyrl.range;
      }
    }

    // Rus tili
    if (ruEntry) {
      if (keywords.questionText) {
        const range = ruEntry.questionKeyword ? (findWordsRange(ruEntry.text, ruEntry.questionKeyword)?.range ?? null) : null;
        if (range) {
          keywords.highlights.question.ru = range;
          keywords.questionTextRu = upperRu(ruEntry.text.slice(...range));
        } else {
          keywords.needsReview = true;
          result.ruKeywordReview.push(`${order}-savol: savol kaliti rus matnida topilmadi (${ruEntry.questionKeyword ?? "berilmagan"})`);
        }
      }
      if (keywords.answerText) {
        const ruAnswer = correctOption.textRu ?? "";
        const range = ruEntry.answerKeyword ? (findWordsRange(ruAnswer, ruEntry.answerKeyword)?.range ?? null) : null;
        if (range) {
          keywords.highlights.answer.ru = range;
          keywords.answerTextRu = upperRu(ruAnswer.slice(...range));
        } else {
          keywords.needsReview = true;
          result.ruKeywordReview.push(`${order}-savol: javob kaliti rus matnida topilmadi (${ruEntry.answerKeyword ?? "berilmagan"})`);
        }
      }
    } else if (keywords.questionText || keywords.answerText) {
      keywords.needsReview = true;
    }

    const explanationLatn = q.explanation ? translit(q.explanation) : null;
    result.questions.push({
      order,
      text: q.text,
      textLatn,
      textRu: ruEntry?.text ?? null,
      explanation: q.explanation,
      explanationLatn,
      explanationRu: ruEntry?.explanation ?? null,
      image,
      options,
      keywords,
      // Ruscha matn AI tarjimasi — qo'lda tekshirilguncha belgilab qo'yamiz.
      ruNeedsReview: true,
      pair,
    });
  }

  return result;
}

/** Tarjima uchun chiqarilgan ma'lumot (content-source/day1/extracted). */
function writeExtract(result: TopicResult) {
  fs.mkdirSync(EXTRACT_DIR, { recursive: true });
  const data = result.questions.map((q) => ({
    order: q.order,
    text: q.text,
    options: Object.fromEntries(q.options.map((o) => [o.order, o.text])),
    correct: q.options.find((o) => o.isCorrect)?.order,
    explanation: q.explanation,
    questionKeywordCyrl: q.keywords.questionTextCyrl,
    answerKeywordCyrl: q.keywords.answerTextCyrl,
  }));
  fs.writeFileSync(path.join(EXTRACT_DIR, `${result.def.slug}.json`), JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Baza

interface LegacyDiff {
  slug: string;
  legacySlug: string;
  lines: string[];
}

async function compareLegacy(prisma: PrismaClient, result: TopicResult): Promise<LegacyDiff | null> {
  const legacySlug = LEGACY_SLUGS[result.def.slug];
  const existing =
    (await prisma.topic.findUnique({ where: { slug: result.def.slug } })) ??
    (legacySlug ? await prisma.topic.findUnique({ where: { slug: legacySlug } }) : null);
  if (!existing) return null;
  const old = await prisma.question.findMany({
    where: { topicId: existing.id },
    include: { options: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
    orderBy: { order: "asc" },
  });
  const lines: string[] = [];
  const byOrder = new Map(result.questions.map((q) => [q.order, q]));
  for (const o of old) {
    const n = byOrder.get(o.order);
    const label = `${o.order}-savol`;
    if (!n) {
      lines.push(`- ${label}: bazada bor, yangi importda bu tartibda savol yo'q — o'chiriladi (eski matn: "${o.text || "(matnsiz)"}")`);
      continue;
    }
    if (comparable(o.text) !== comparable(n.text)) lines.push(`- ${label}: matn farq qiladi — baza: "${o.text || "(matnsiz)"}" → docx: "${n.text}"`);
    const oldOpts = o.options.map((x) => x.text);
    const newOpts = n.options.map((x) => x.text);
    // Eski bankda variantlar tartibi saqlanmagan (bir xil createdAt) — faqat tarkibi solishtiriladi.
    const sorted = (list: string[]) => list.map(comparable).sort().join("|");
    if (sorted(oldOpts) !== sorted(newOpts)) {
      lines.push(`- ${label}: variantlar farq qiladi — baza: [${oldOpts.join(" / ")}] → docx: [${newOpts.join(" / ")}]`);
    }
    const oldCorrect = o.options.find((x) => x.isCorrect)?.text ?? "(belgilanmagan)";
    const newCorrect = n.options.find((x) => x.isCorrect)?.text ?? "";
    if (comparable(oldCorrect) !== comparable(newCorrect)) lines.push(`- ${label}: to'g'ri javob farq qiladi — baza: "${oldCorrect}" → docx: "${newCorrect}"`);
    const oldImage = o.imageUrl ? path.basename(o.imageUrl) : "(rasmsiz)";
    const newImage = n.image ? n.image.file : "(rasmsiz)";
    if (oldImage !== newImage) lines.push(`- ${label}: rasm almashtiriladi — baza: ${oldImage} → ${newImage}`);
  }
  for (const n of result.questions) {
    if (!old.some((o) => o.order === n.order)) lines.push(`- ${n.order}-savol: bazada yo'q edi — qo'shiladi`);
  }
  return { slug: result.def.slug, legacySlug: existing.slug, lines };
}

async function writeTopic(prisma: PrismaClient, result: TopicResult) {
  const { def } = result;
  const legacySlug = LEGACY_SLUGS[def.slug];
  const topicData = {
    title: def.title.uz,
    titleCyrl: def.title.cyrl,
    titleRu: def.title.ru,
    day: 1,
    dayOrder: def.order,
  };

  await prisma.$transaction(
    async (tx) => {
      let topic = await tx.topic.findUnique({ where: { slug: def.slug } });
      if (!topic && legacySlug) {
        const legacy = await tx.topic.findUnique({ where: { slug: legacySlug } });
        if (legacy) topic = await tx.topic.update({ where: { id: legacy.id }, data: { slug: def.slug } });
      }
      topic = topic
        ? await tx.topic.update({ where: { id: topic.id }, data: topicData })
        : await tx.topic.create({ data: { slug: def.slug, ...topicData } });

      const orders = result.questions.map((q) => q.order);
      await tx.question.deleteMany({ where: { topicId: topic.id, order: { notIn: orders } } });

      for (const q of result.questions) {
        const correct = q.options.find((o) => o.isCorrect);
        const data = {
          text: q.text,
          textLatn: q.textLatn,
          textRu: q.textRu,
          imageUrl: q.image ? `/images/${q.image.file}` : null,
          imageWidth: q.image?.width ?? null,
          imageHeight: q.image?.height ?? null,
          explanation: q.explanation,
          explanationLatn: q.explanationLatn,
          explanationRu: q.explanationRu,
          // Eski format (Saqlanganlar va eski klientlar uchun): javob kaliti, bo'lmasa savol kaliti.
          keyword: q.keywords.answerText ?? q.keywords.questionText ?? "",
          keywordRu: q.keywords.answerTextRu ?? q.keywords.questionTextRu ?? null,
          needsReview: false,
          ruNeedsReview: q.ruNeedsReview,
        };
        const question = await tx.question.upsert({
          where: { topicId_order: { topicId: topic.id, order: q.order } },
          update: data,
          create: { topicId: topic.id, order: q.order, ...data },
        });

        // Variantlar tartib bo'yicha upsert — ID'lar qayta importda o'zgarmaydi.
        await tx.option.deleteMany({ where: { questionId: question.id, order: { notIn: q.options.map((o) => o.order) } } });
        for (const o of q.options) {
          const optionData = { text: o.text, textLatn: o.textLatn, textRu: o.textRu, isCorrect: o.isCorrect };
          await tx.option.upsert({
            where: { questionId_order: { questionId: question.id, order: o.order } },
            update: optionData,
            create: { questionId: question.id, order: o.order, ...optionData },
          });
        }
        if (!correct) throw new Error(`${def.slug} ${q.order}-savol: to'g'ri javob yo'q`);

        const k = q.keywords;
        const keywordData = {
          questionText: k.questionText,
          questionTextCyrl: k.questionTextCyrl,
          questionTextRu: k.questionTextRu,
          answerText: k.answerText,
          answerTextCyrl: k.answerTextCyrl,
          answerTextRu: k.answerTextRu,
          highlights: k.highlights as unknown as Prisma.InputJsonValue,
          source: k.source,
          docxKeyword: k.docxKeyword,
          needsReview: k.needsReview,
        };
        await tx.questionKeyword.upsert({
          where: { questionId: question.id },
          update: keywordData,
          create: { questionId: question.id, ...keywordData },
        });
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
}

// ---------------------------------------------------------------------------
// Hisobot

function buildReport(results: TopicResult[], missingFiles: string[], legacy: LegacyDiff[], written: boolean): string {
  const out: string[] = [];
  out.push("# 1-kun testlari — import hisoboti", "");
  out.push(`Sana: ${new Date().toISOString()}  `);
  out.push(`Rejim: ${written ? "bazaga yozildi" : "dry-run (bazaga yozilmadi)"}`, "");
  if (missingFiles.length) out.push("## Topilmagan fayllar", "", ...missingFiles.map((f) => `- ${f}`), "");

  out.push("## 1. Mavzular bo'yicha", "");
  out.push("| # | Mavzu | Docx'dagi savollar | Import qilindi | Rasmlar | Kalit so'z bog'landi | Kalit so'z mavjud emas | HTML kartochkalar |");
  out.push("|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    const linked = r.questions.filter((q) => q.keywords.questionText || q.keywords.answerText).length;
    const paired = r.questions.filter((q) => q.pair).length;
    out.push(
      `| ${r.def.order} | ${r.def.title.uz} | ${r.parsedCount}${r.declaredCount !== null ? ` (e'lon: ${r.declaredCount})` : ""} | ${r.questions.length} | ${r.imageCount} | ${linked} | ${r.questions.length - linked} | ${paired + r.unpairedHtml.length} (juftlangan: ${paired}) |`,
    );
  }
  out.push("");
  out.push("Fayllar va sarlavhalar (bog'lash nom bo'yicha tasdiqlangan):", "");
  for (const r of results) {
    out.push(`- **${r.def.order}. ${r.def.title.uz}** — docx: \`${r.docxFile}\` (sarlavha: "${r.docxTitle}"); html: ${r.htmlFile ? `\`${r.htmlFile}\` (<h1>: "${r.htmlTitle}")` : "topilmadi"}`);
  }
  out.push("");

  out.push("## 2. Import qilinmagan savollar", "");
  const skipped = results.flatMap((r) => r.skipped.map((s) => `- ${r.def.order}-mavzu, ${s.number}-savol: ${s.reason}`));
  out.push(...(skipped.length ? skipped : ["Yo'q."]), "");

  out.push("## 3. HTML va docx'da to'g'ri javobi farq qilgan savollar", "");
  out.push("To'g'ri javob sifatida doim DOCX'dagi qalin variant olindi.", "");
  const conflicts = results.flatMap((r) =>
    r.answerConflicts.map(
      (c) =>
        `- ${r.def.order}-mavzu, ${c.order}-savol (o'xshashlik ${c.sim.toFixed(2)}): docx — "${c.docx}"; HTML — "${c.html}"${c.htmlMatchesOther ? ` ⚠️ HTML javobi docx'dagi boshqa variantga mos: ${c.htmlMatchesOther}` : ""}`,
    ),
  );
  out.push(...(conflicts.length ? conflicts : ["Yo'q."]), "");
  const keyMissing = results.flatMap((r) =>
    r.answerKeyMissing.map((c) => `- ${r.def.order}-mavzu, ${c.order}-savol: javob kaliti "${c.kAns}" docx javobida ("${c.docx}") uchramadi — javob kaliti bog'lanmadi`),
  );
  if (keyMissing.length) out.push("Javob kaliti bog'lanmagan savollar:", "", ...keyMissing, "");
  const qKeyMissing = results.flatMap((r) =>
    r.questionKeyMissing.map((c) => `- ${r.def.order}-mavzu, ${c.order}-savol: savol kaliti "${c.kq}" kirill matnda topilmadi — belgilashsiz saqlandi`),
  );
  if (qKeyMissing.length) out.push("Savol kaliti kirill matnda topilmagan savollar:", "", ...qKeyMissing, "");

  out.push("## 4. HTML'da juftsiz qolgan savollar (testga qo'shilmagan)", "");
  const unpaired = results.flatMap((r) =>
    r.unpairedHtml.map((c) => `- ${r.def.order}-mavzu, HTML'dagi ${c.index}-kartochka: "${c.question}" → "${c.answer}"`),
  );
  out.push(...(unpaired.length ? unpaired : ["Yo'q."]), "");

  out.push("## 5. 0.8–0.9 o'xshashlikda juftlangan savollar (qo'lda tekshirish uchun)", "");
  const low = results.flatMap((r) =>
    r.lowSimilarityPairs.map((p) => `- ${r.def.order}-mavzu, ${p.order}-savol (${p.qSim.toFixed(2)}): docx — "${p.docx}"; HTML — "${p.html}"`),
  );
  out.push(...(low.length ? low : ["Yo'q."]), "");

  out.push("Juftliksiz docx savollari uchun eng yaqin juftsiz HTML kartochka (o'xshashlik 0.8 dan past — juftlanmadi, kalit so'z \"mavjud emas\"; qo'lda tekshirish uchun):", "");
  const near = results.flatMap((r) =>
    r.nearMisses.map((p) => `- ${r.def.order}-mavzu, ${p.order}-savol (savol ${p.qSim.toFixed(2)}, javob ${p.aSim.toFixed(2)}): docx — "${p.docx}"; HTML — "${p.html}"`),
  );
  out.push(...(near.length ? near : ["Yo'q."]), "");
  out.push("Kalit so'z belgilashi so'z darajasida taxminiy topilgan joylar (qo'shimcha yoki imlo farqi):", "");
  const approx = results.flatMap((r) => r.approximate.map((a) => `- ${r.def.order}-mavzu, ${a}`));
  out.push(...(approx.length ? approx : ["Yo'q."]), "");

  out.push("## Raqamlash va boshqa ogohlantirishlar", "");
  const warn = results.flatMap((r) => [...r.numbering, ...r.warnings].map((w) => `- ${r.def.order}-mavzu: ${w}`));
  out.push(...(warn.length ? warn : ["Yo'q."]), "");

  out.push("## 7. Avtomatik tarjima (rus tili) — tekshirilishi kerak", "");
  out.push("Barcha ruscha matnlar (savol, variantlar, kalit so'zlar) AI tarjimasi — bazada `ruNeedsReview = true`.", "");
  const ruMissing = results.flatMap((r) => (r.ruMissing.length ? [`- ${r.def.order}-mavzu: tarjimasi yo'q savollar — ${r.ruMissing.join(", ")}`] : []));
  const ruKw = results.flatMap((r) => r.ruKeywordReview.map((x) => `- ${r.def.order}-mavzu, ${x}`));
  out.push(...(ruMissing.length || ruKw.length ? [...ruMissing, ...ruKw] : ["Kalit so'zlarning hammasi rus matnida topildi."]), "");

  if (legacy.length) {
    out.push("## Bazadagi mavjud yozuvlar bilan solishtirish", "");
    for (const l of legacy) {
      out.push(`### ${l.slug} (bazada: \`${l.legacySlug}\`)`, "");
      out.push(...(l.lines.length ? l.lines : ["Farq yo'q."]), "");
    }
  }
  if (fs.existsSync(REPORT_NOTES_PATH)) out.push(fs.readFileSync(REPORT_NOTES_PATH, "utf8"));
  return out.join("\n");
}

// ---------------------------------------------------------------------------

async function main() {
  const docxDir = path.join(SOURCE_DIR, "docx");
  const htmlDir = path.join(SOURCE_DIR, "keywords");
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const missingFiles: string[] = [];
  const files = (dir: string, ext: string) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(ext) && !f.startsWith("~$")) : []);

  // Mavzu ↔ fayl — faqat sarlavha (docx: birinchi qator, HTML: <h1>) bo'yicha.
  const docxByTopic = new Map<string, string>();
  for (const file of files(docxDir, ".docx")) {
    const full = path.join(docxDir, file);
    const title = parseQuestions((await readDocx(fs.readFileSync(full))).paragraphs).title;
    const matched = matchTopic(title);
    if (matched.length !== 1) throw new Error(`Docx sarlavhasi bitta mavzuga mos kelmadi: "${title}" (${file})`);
    if (docxByTopic.has(matched[0].slug)) throw new Error(`Bitta mavzu uchun ikkita docx: ${file}`);
    docxByTopic.set(matched[0].slug, full);
  }
  const htmlByTopic = new Map<string, string>();
  for (const file of files(htmlDir, ".html")) {
    const full = path.join(htmlDir, file);
    const title = parseKeywordsHtml(fs.readFileSync(full, "utf8")).title;
    const matched = matchTopic(title);
    if (matched.length !== 1) throw new Error(`HTML <h1> bitta mavzuga mos kelmadi: "${title}" (${file})`);
    if (htmlByTopic.has(matched[0].slug)) throw new Error(`Bitta mavzu uchun ikkita HTML: ${file}`);
    htmlByTopic.set(matched[0].slug, full);
  }

  const results: TopicResult[] = [];
  for (const def of TOPICS) {
    const docxPath = docxByTopic.get(def.slug);
    const htmlPath = htmlByTopic.get(def.slug) ?? null;
    if (!docxPath) {
      missingFiles.push(`${def.order}-mavzu (${def.title.uz}): docx topilmadi — o'tkazib yuborildi`);
      continue;
    }
    if (!htmlPath) missingFiles.push(`${def.order}-mavzu (${def.title.uz}): kalit so'z HTML topilmadi — kalit so'zlar "mavjud emas"`);
    const result = await processTopic(def, docxPath, htmlPath);
    writeExtract(result);
    results.push(result);
    console.log(`${def.slug}: ${result.questions.length}/${result.parsedCount} savol, ${result.imageCount} rasm, ${result.skipped.length} tasi o'tkazildi`);
  }

  const prisma = new PrismaClient();
  try {
    const legacy: LegacyDiff[] = [];
    for (const r of results) {
      const diff = await compareLegacy(prisma, r);
      if (diff) legacy.push(diff);
    }
    if (!DRY_RUN) {
      for (const r of results) await writeTopic(prisma, r);
    }
    fs.writeFileSync(REPORT_PATH, buildReport(results, missingFiles, legacy, !DRY_RUN));
    console.log(`${DRY_RUN ? "Dry-run" : "Import"} tugadi. Hisobot: ${REPORT_PATH}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
