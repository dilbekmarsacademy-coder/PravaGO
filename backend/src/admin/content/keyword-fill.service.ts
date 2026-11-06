import { HttpException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AiService } from "../../ai/ai.service";
import { STUDENT_QUESTION_WHERE } from "../../common/question-content";
import { PrismaService } from "../../prisma/prisma.service";
import type { AdminUser } from "../admin-request";
import { AuditService } from "../audit.service";
import { locatePhrases } from "./question-create.service";
import type { Lang } from "./question-editor.service";

// O'quvchi javobdan keyin har savolda kalit so'zni ko'rishi shart: savol kaliti
// va javob kaliti — matni bor har bir tilda (lotin, kirill, rus). Yetishmaganlari
// admin panelda ko'rsatiladi va AI bilan to'ldiriladi (needsReview — admin ko'radi).

type Range = [number, number];
type Texts = Record<Lang, string>;
type Part = "question" | "answer";
const LANGS: Lang[] = ["uz", "cyrl", "ru"];
const LANG_LABEL: Record<Lang, string> = { uz: "lotin", cyrl: "kirill", ru: "rus" };
const PART_LABEL: Record<Part, string> = { question: "savol kaliti", answer: "javob kaliti" };

const CHIP_FIELD: Record<Part, Record<Lang, "questionText" | "questionTextCyrl" | "questionTextRu" | "answerText" | "answerTextCyrl" | "answerTextRu">> = {
  question: { uz: "questionText", cyrl: "questionTextCyrl", ru: "questionTextRu" },
  answer: { uz: "answerText", cyrl: "answerTextCyrl", ru: "answerTextRu" },
};

const questionSelect = {
  id: true,
  order: true,
  text: true,
  textLatn: true,
  textRu: true,
  topic: { select: { slug: true, title: true, titleCyrl: true, kind: true } },
  options: { where: { isCorrect: true }, select: { text: true, textLatn: true, textRu: true }, take: 1 },
  keywords: true,
} satisfies Prisma.QuestionSelect;
type Row = Prisma.QuestionGetPayload<{ select: typeof questionSelect }>;

const isCyrillic = (s: string) => /[Ѐ-ӿ]/.test(s);

/** Eski yozuvlarda `text` lotin bo'lishi mumkin (toEditable bilan bir xil qoida). */
function texts(t: { text: string; textLatn: string | null; textRu: string | null }): Texts {
  return {
    uz: (t.textLatn ?? (isCyrillic(t.text) ? "" : t.text)).trim(),
    cyrl: (isCyrillic(t.text) ? t.text : "").trim(),
    ru: (t.textRu ?? "").trim(),
  };
}

function asRanges(value: unknown): Range[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  if (value.length === 2 && typeof value[0] === "number") return [value as Range];
  return (value as unknown[]).filter((r): r is Range => Array.isArray(r) && r.length === 2 && r.every((n) => Number.isInteger(n)));
}

const chip = (text: string, ranges: Range[]) => ranges.map(([s, e]) => text.slice(s, e).trim().toUpperCase()).filter(Boolean).join(" + ");

export interface MissingKeywordItem {
  id: string;
  topicSlug: string;
  topicTitle: string;
  order: number;
  text: string;
  /** Masalan: "savol kaliti (rus)". */
  missing: string[];
}

/** Savolning har bir qismi va tili bo'yicha: mavjud chip matni va belgilash. */
function analyse(q: Row) {
  const correct = q.options[0];
  const source: Record<Part, Texts> = { question: texts(q), answer: correct ? texts(correct) : { uz: "", cyrl: "", ru: "" } };
  const highlights = (q.keywords?.highlights ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const missing: { part: Part; lang: Lang }[] = [];
  const existing: Record<Part, Record<Lang, string[]>> = { question: { uz: [], cyrl: [], ru: [] }, answer: { uz: [], cyrl: [], ru: [] } };
  for (const part of ["question", "answer"] as Part[]) {
    for (const lang of LANGS) {
      const text = source[part][lang];
      const value = q.keywords?.[CHIP_FIELD[part][lang]]?.trim();
      const ranges = asRanges(highlights[part]?.[lang]).filter(([s, e]) => s >= 0 && e <= text.length && s < e);
      if (value) existing[part][lang] = ranges.length ? ranges.map(([s, e]) => text.slice(s, e)) : value.split(" + ");
      else if (text) missing.push({ part, lang });
    }
  }
  return { source, missing, existing, highlights };
}

@Injectable()
export class KeywordFillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly audit: AuditService,
  ) {}

  private rows(ids?: string[]): Promise<Row[]> {
    return this.prisma.question.findMany({
      where: { ...STUDENT_QUESTION_WHERE, topic: { deletedAt: null }, ...(ids ? { id: { in: ids } } : {}) },
      orderBy: [{ topic: { slug: "asc" } }, { order: "asc" }],
      select: questionSelect,
    });
  }

  /** O'quvchiga ko'rinadigan, kalit so'zi yo'q yoki biror tilda to'liq bo'lmagan savollar. */
  async missing(): Promise<{ total: number; items: MissingKeywordItem[] }> {
    const items: MissingKeywordItem[] = [];
    for (const q of await this.rows()) {
      const { missing } = analyse(q);
      if (!missing.length) continue;
      const title = q.topic.title !== q.topic.slug ? q.topic.title : q.topic.titleCyrl ?? q.topic.slug;
      items.push({
        id: q.id,
        topicSlug: q.topic.slug,
        topicTitle: title,
        order: q.order,
        text: texts(q).uz || texts(q).cyrl,
        missing: missing.map((m) => `${PART_LABEL[m.part]} (${LANG_LABEL[m.lang]})`),
      });
    }
    return { total: items.length, items };
  }

  /** Berilgan savollarga yetishmayotgan kalit so'zlarni AI bilan qo'shadi (mavjudlari o'zgarmaydi). */
  async fill(admin: AdminUser, ip: string, ids: string[]): Promise<{ filled: number; failed: { id: string; reason: string }[] }> {
    const failed: { id: string; reason: string }[] = [];
    let filled = 0;
    for (const q of await this.rows(ids)) {
      const { source, missing, existing, highlights } = analyse(q);
      if (!missing.length) continue;
      try {
        const phrases = await this.ai.pickKeywords({ question: source.question, correctAnswer: source.answer, existing }, { adminId: admin.id });
        const data: Prisma.QuestionKeywordUncheckedUpdateInput = {};
        const nextHighlights: Record<Part, Record<string, unknown>> = { question: { ...(highlights.question ?? {}) }, answer: { ...(highlights.answer ?? {}) } };
        const notFound: string[] = [];
        for (const { part, lang } of missing) {
          const { ranges } = locatePhrases(source[part][lang], phrases[part][lang]);
          if (!ranges.length) {
            notFound.push(`${PART_LABEL[part]} (${LANG_LABEL[lang]})`);
            continue;
          }
          data[CHIP_FIELD[part][lang]] = chip(source[part][lang], ranges);
          nextHighlights[part][lang] = ranges.length === 1 ? ranges[0] : ranges;
        }
        if (Object.keys(data).length) {
          const fields = { ...data, highlights: nextHighlights as Prisma.InputJsonValue, needsReview: true };
          const before = q.keywords;
          const after = await this.prisma.questionKeyword.upsert({
            where: { questionId: q.id },
            update: { ...fields, ...(before?.source === "none" || !before?.source ? { source: "ai" } : {}) },
            create: { questionId: q.id, ...(fields as Prisma.QuestionKeywordUncheckedCreateWithoutQuestionInput), source: "ai" },
          });
          // Eski bitta matnli kalit (ba'zi eski ekranlar) — javob kaliti bilan bir xil.
          await this.prisma.question.update({ where: { id: q.id }, data: { keyword: after.answerText ?? "", keywordRu: after.answerTextRu } });
          await this.audit.log(admin, ip, { action: "question.keywords_filled", entityType: "question", entityId: q.id, before, after });
          filled++;
        }
        if (notFound.length) failed.push({ id: q.id, reason: `AI matndan topa olmadi: ${notFound.join(", ")}` });
      } catch (err) {
        // AI sozlanmagan yoki budjet tugagan — qolganlarini urinishdan foyda yo'q.
        const code = err instanceof HttpException ? (err.getResponse() as { code?: string }).code : undefined;
        if (code === "AI_NOT_CONFIGURED" || code === "AI_BUDGET_EXCEEDED") throw err;
        failed.push({ id: q.id, reason: err instanceof Error ? err.message : "AI xatosi" });
      }
    }
    return { filled, failed };
  }
}
