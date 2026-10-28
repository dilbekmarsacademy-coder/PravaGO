import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { OPTION_ORDER } from "../../common/question-content";
import { parseCourseSlug } from "../../common/rules";
import type { AdminUser } from "../admin-request";
import { AuditService } from "../audit.service";
import { editableDays } from "./content.config";
import type { HighlightInputDto, LangTextDto, QuestionInputDto } from "./question-input.dto";

export type Lang = "uz" | "cyrl" | "ru";
const LANGS: Lang[] = ["uz", "cyrl", "ru"];
type Ranges = Partial<Record<Lang, [number, number][]>>;

/** Admin tahrirlaydigan to'liq savol (to'g'ri javob va kalit so'zlar bilan) — faqat admin API'da. */
export interface EditableQuestionDto {
  id: string;
  topicSlug: string;
  topicKind: string;
  order: number;
  text: { cyrl: string; latn: string; ru: string };
  options: { id: string; order: number; text: { cyrl: string; latn: string; ru: string }; isCorrect: boolean }[];
  correctIndex: number | null;
  explanation: { cyrl: string; latn: string; ru: string };
  image: { url: string; width: number | null; height: number | null; assetId: string | null } | null;
  keywords: { none: boolean; question: Ranges; answer: Ranges; needsReview: boolean; source: string | null };
  needsReview: boolean;
  ruNeedsReview: boolean;
  updatedAt: Date;
  deletedAt: Date | null;
}

const questionInclude = {
  options: { orderBy: OPTION_ORDER },
  keywords: true,
  topic: { select: { slug: true, kind: true } },
} satisfies Prisma.QuestionInclude;
type FullQuestion = Prisma.QuestionGetPayload<{ include: typeof questionInclude }>;

/** Matn tili bo'yicha: uz → lotin, cyrl → kirill, ru → rus. */
function textFor(t: { cyrl: string; latn: string; ru: string }, lang: Lang): string {
  return lang === "uz" ? t.latn : lang === "cyrl" ? t.cyrl : t.ru;
}

function asRanges(value: unknown): [number, number][] {
  if (!Array.isArray(value) || value.length === 0) return [];
  if (value.length === 2 && typeof value[0] === "number") return [value as [number, number]];
  return (value as unknown[]).filter((r): r is [number, number] => Array.isArray(r) && r.length === 2);
}

function rangesFromJson(value: unknown): Ranges {
  const out: Ranges = {};
  if (!value || typeof value !== "object") return out;
  for (const lang of LANGS) {
    const r = asRanges((value as Record<string, unknown>)[lang]);
    if (r.length) out[lang] = r;
  }
  return out;
}

function clean(s: string | undefined | null): string {
  return (s ?? "").trim();
}

function isCyrillic(s: string): boolean {
  return /[Ѐ-ӿ]/.test(s);
}

export function toEditable(q: FullQuestion): EditableQuestionDto {
  // Eski yozuvlarda `text` lotin bo'lishi mumkin (toLocalizedText bilan bir xil qoida).
  const cyrl = isCyrillic(q.text) ? q.text : "";
  const latn = q.textLatn ?? (isCyrillic(q.text) ? "" : q.text);
  const highlights = (q.keywords?.highlights ?? {}) as Record<string, unknown>;
  const hasKeywords = Boolean(q.keywords && (q.keywords.questionText || q.keywords.questionTextCyrl || q.keywords.answerText || q.keywords.answerTextCyrl));
  const correctIndex = q.options.findIndex((o) => o.isCorrect);
  return {
    id: q.id,
    topicSlug: q.topic.slug,
    topicKind: q.topic.kind,
    order: q.order,
    text: { cyrl, latn, ru: q.textRu ?? "" },
    options: q.options.map((o) => ({
      id: o.id,
      order: o.order,
      text: { cyrl: isCyrillic(o.text) ? o.text : "", latn: o.textLatn ?? (isCyrillic(o.text) ? "" : o.text), ru: o.textRu ?? "" },
      isCorrect: o.isCorrect,
    })),
    correctIndex: correctIndex >= 0 ? correctIndex : null,
    explanation: { cyrl: q.explanation ?? "", latn: q.explanationLatn ?? "", ru: q.explanationRu ?? "" },
    image: q.imageUrl ? { url: q.imageUrl, width: q.imageWidth, height: q.imageHeight, assetId: q.imageAssetId } : null,
    keywords: {
      none: !hasKeywords,
      question: rangesFromJson(highlights.question),
      answer: rangesFromJson(highlights.answer),
      needsReview: q.keywords?.needsReview ?? false,
      source: q.keywords?.source ?? null,
    },
    needsReview: q.needsReview,
    ruNeedsReview: q.ruNeedsReview,
    updatedAt: q.updatedAt,
    deletedAt: q.deletedAt,
  };
}

/** Oraliqlar: butun son, 0 ≤ start < end ≤ matn uzunligi, o'sib boruvchi va kesishmaydigan. */
export function validateRanges(input: HighlightInputDto | undefined, texts: { cyrl: string; latn: string; ru: string }, where: string): Ranges {
  const out: Ranges = {};
  if (!input) return out;
  for (const lang of LANGS) {
    const raw = input[lang];
    if (!raw?.length) continue;
    const text = textFor(texts, lang);
    if (!text) throw new BadRequestException(`${where}: ${lang} matni yo'q, belgilash qo'yib bo'lmaydi`);
    const ranges = raw.map((r) => {
      if (r.length !== 2 || !r.every((n) => Number.isInteger(n))) throw new BadRequestException(`${where}: noto'g'ri oraliq`);
      return [r[0], r[1]] as [number, number];
    });
    ranges.sort((a, b) => a[0] - b[0]);
    let pos = 0;
    for (const [start, end] of ranges) {
      if (start < pos || start >= end || end > text.length) {
        throw new BadRequestException(`${where} (${lang}): belgilash matn chegarasidan tashqarida yoki bo'laklar kesishadi`);
      }
      pos = end;
    }
    out[lang] = ranges;
  }
  return out;
}

/** Belgilangan bo'laklardan chip matni: "3 TONNA + MOPED". */
function chipText(text: string, ranges: [number, number][] | undefined): string | null {
  if (!text || !ranges?.length) return null;
  return ranges.map(([s, e]) => text.slice(s, e).trim().toUpperCase()).filter(Boolean).join(" + ") || null;
}

function stored(ranges: [number, number][] | undefined): [number, number] | [number, number][] | undefined {
  if (!ranges?.length) return undefined;
  return ranges.length === 1 ? ranges[0] : ranges;
}

export interface NormalizedQuestion {
  text: { cyrl: string; latn: string; ru: string };
  options: { id?: string; text: { cyrl: string; latn: string; ru: string } }[];
  correctIndex: number;
  explanation: { cyrl: string; latn: string; ru: string };
  keywords: { none: boolean; question: Ranges; answer: Ranges };
}

function normText(t: LangTextDto | undefined): { cyrl: string; latn: string; ru: string } {
  return { cyrl: clean(t?.cyrl), latn: clean(t?.latn), ru: clean(t?.ru) };
}

/**
 * Backend validatsiyasi: o'zbekcha matn ikkala yozuvda, 2–6 variant, aynan
 * bitta to'g'ri javob, belgilash diapazonlari matn ichida.
 */
export function normalizeQuestionInput(input: QuestionInputDto): NormalizedQuestion {
  const text = normText(input.text);
  if (!text.cyrl || !text.latn) throw new BadRequestException("Savol matni kirill va lotin yozuvida bo'lishi kerak");
  const options = input.options.map((o, i) => {
    const t = normText(o.text);
    if (!t.cyrl || !t.latn) throw new BadRequestException(`${i + 1}-variant matni kirill va lotin yozuvida bo'lishi kerak`);
    return { id: o.id, text: t };
  });
  if (options.length < 2 || options.length > 6) throw new BadRequestException("Variantlar soni 2 tadan 6 tagacha bo'lishi kerak");
  const ids = options.flatMap((o) => (o.id ? [o.id] : []));
  if (new Set(ids).size !== ids.length) throw new BadRequestException("Variant takrorlangan");
  if (!Number.isInteger(input.correctIndex) || input.correctIndex < 0 || input.correctIndex >= options.length) {
    throw new BadRequestException("To'g'ri javob aynan bitta va variantlar orasida bo'lishi kerak");
  }
  const explanation = normText(input.explanation);
  const none = input.keywords.none;
  const question = none ? {} : validateRanges(input.keywords.question, text, "Savol kaliti");
  const answer = none ? {} : validateRanges(input.keywords.answer, options[input.correctIndex].text, "Javob kaliti");
  if (!none && !Object.keys(question).length && !Object.keys(answer).length) {
    throw new BadRequestException("Kalit so'z belgilanmagan — belgilang yoki \"Kalit so'z mavjud emas\"ni tanlang");
  }
  return { text, options, correctIndex: input.correctIndex, explanation, keywords: { none, question, answer } };
}

@Injectable()
export class QuestionEditorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async load(id: string): Promise<FullQuestion> {
    const q = await this.prisma.question.findUnique({ where: { id }, include: questionInclude });
    if (!q) throw new NotFoundException("Savol topilmadi");
    return q;
  }

  async get(id: string): Promise<EditableQuestionDto> {
    return toEditable(await this.load(id));
  }

  /** Kurs mavzusi — faqat ochiq kunlar; "Yangi testlar" to'plami — doim. */
  assertEditable(topic: { slug: string; kind: string }): void {
    if (topic.kind === "collection") return;
    const parsed = parseCourseSlug(topic.slug);
    if (!parsed || !editableDays().includes(parsed.day)) {
      throw new ForbiddenException({ statusCode: 403, code: "DAY_NOT_EDITABLE", message: "Bu kun admin panelda tahrirlash uchun hali ochilmagan" });
    }
  }

  private async imageFields(input: QuestionInputDto) {
    if (input.removeImage) return { imageUrl: null, imageWidth: null, imageHeight: null, imageAssetId: null };
    if (!input.imageAssetId) return {};
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: input.imageAssetId },
      select: { id: true, public: true, width: true, height: true },
    });
    if (!asset || !asset.public) throw new BadRequestException("Rasm topilmadi yoki hali tasdiqlanmagan");
    return { imageUrl: `/media/${asset.id}.webp`, imageWidth: asset.width, imageHeight: asset.height, imageAssetId: asset.id };
  }

  /** Savol, variantlar va kalit so'zlarni bitta tranzaksiyada yozadi. */
  async write(tx: Prisma.TransactionClient, questionId: string, input: QuestionInputDto, data: NormalizedQuestion, extra: Prisma.QuestionUpdateInput = {}): Promise<void> {
    const image = await this.imageFields(input);
    const correct = data.options[data.correctIndex].text;
    const { question: qRanges, answer: aRanges, none } = data.keywords;
    await tx.question.update({
      where: { id: questionId },
      data: {
        text: data.text.cyrl,
        textLatn: data.text.latn,
        textRu: data.text.ru || null,
        explanation: data.explanation.cyrl || null,
        explanationLatn: data.explanation.latn || null,
        explanationRu: data.explanation.ru || null,
        keyword: none ? "" : chipText(correct.latn, aRanges.uz) ?? "",
        keywordRu: none ? null : chipText(correct.ru, aRanges.ru),
        needsReview: false,
        ...(input.ruNeedsReview !== undefined ? { ruNeedsReview: input.ruNeedsReview } : {}),
        ...image,
        ...extra,
      },
    });

    // Variantlar: mavjudlari id bo'yicha yangilanadi, yangilari qo'shiladi, qolganlari o'chiriladi.
    const existing = await tx.option.findMany({ where: { questionId }, select: { id: true } });
    const keep = new Set(data.options.flatMap((o) => (o.id ? [o.id] : [])));
    for (const id of keep) {
      if (!existing.some((e) => e.id === id)) throw new BadRequestException("Variant bu savolga tegishli emas");
    }
    await tx.option.deleteMany({ where: { questionId, id: { notIn: [...keep] } } });
    // UNIQUE(questionId, order) — avval vaqtinchalik manfiy tartib.
    for (const [i, id] of [...keep].entries()) await tx.option.update({ where: { id }, data: { order: -1000 - i } });
    for (const [i, o] of data.options.entries()) {
      const fields = { order: i + 1, text: o.text.cyrl, textLatn: o.text.latn, textRu: o.text.ru || null, isCorrect: i === data.correctIndex };
      if (o.id) await tx.option.update({ where: { id: o.id }, data: fields });
      else await tx.option.create({ data: { questionId, ...fields } });
    }

    const keywordData = none
      ? {
          questionText: null,
          questionTextCyrl: null,
          questionTextRu: null,
          answerText: null,
          answerTextCyrl: null,
          answerTextRu: null,
          highlights: {},
          source: "none",
          needsReview: false,
        }
      : {
          questionText: chipText(data.text.latn, qRanges.uz),
          questionTextCyrl: chipText(data.text.cyrl, qRanges.cyrl),
          questionTextRu: chipText(data.text.ru, qRanges.ru),
          answerText: chipText(correct.latn, aRanges.uz),
          answerTextCyrl: chipText(correct.cyrl, aRanges.cyrl),
          answerTextRu: chipText(correct.ru, aRanges.ru),
          highlights: {
            question: { uz: stored(qRanges.uz), cyrl: stored(qRanges.cyrl), ru: stored(qRanges.ru) },
            answer: { uz: stored(aRanges.uz), cyrl: stored(aRanges.cyrl), ru: stored(aRanges.ru) },
          } as Prisma.InputJsonValue,
          source: "admin",
          // Biror tilda belgilash yetishmasa — keyinroq tekshirish uchun.
          needsReview: (["uz", "cyrl", "ru"] as Lang[]).some(
            (lang) => (Object.keys(qRanges).length > 0 && !qRanges[lang]) || (Object.keys(aRanges).length > 0 && !aRanges[lang]),
          ),
        };
    await tx.questionKeyword.upsert({ where: { questionId }, update: keywordData, create: { questionId, ...keywordData } });
  }

  async update(admin: AdminUser, ip: string, id: string, input: QuestionInputDto): Promise<EditableQuestionDto> {
    const current = await this.load(id);
    this.assertEditable(current.topic);
    if (current.deletedAt) throw new BadRequestException("O'chirilgan savolni tahrirlab bo'lmaydi");
    const data = normalizeQuestionInput(input);
    const before = toEditable(current);
    await this.prisma.$transaction(async (tx) => {
      await this.write(tx, id, input, data);
    });
    const after = await this.get(id);
    await this.audit.log(admin, ip, { action: "question.updated", entityType: "question", entityId: id, before, after });
    return after;
  }

  /** "Tekshirildi": AI tarjima va kalit so'z belgilari qo'lda ko'rib chiqildi. */
  async markReviewed(admin: AdminUser, ip: string, id: string): Promise<EditableQuestionDto> {
    const current = await this.load(id);
    this.assertEditable(current.topic);
    await this.prisma.$transaction([
      this.prisma.question.update({ where: { id }, data: { ruNeedsReview: false } }),
      this.prisma.questionKeyword.updateMany({ where: { questionId: id }, data: { needsReview: false } }),
    ]);
    await this.audit.log(admin, ip, {
      action: "question.reviewed",
      entityType: "question",
      entityId: id,
      before: { ruNeedsReview: current.ruNeedsReview, keywordNeedsReview: current.keywords?.needsReview ?? false },
      after: { ruNeedsReview: false, keywordNeedsReview: false },
    });
    return this.get(id);
  }
}
