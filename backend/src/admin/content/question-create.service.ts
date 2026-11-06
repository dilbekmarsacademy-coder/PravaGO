import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AiService } from "../../ai/ai.service";
import { latinToCyrillic } from "../../common/translit";
import { PrismaService } from "../../prisma/prisma.service";
import type { AdminUser } from "../admin-request";
import { QuestionEditorService, validateRanges, type EditableQuestionDto, type Lang } from "./question-editor.service";
import type { PrepareQuestionDto, QuestionInputDto } from "./question-input.dto";

type Range = [number, number];
type Ranges = Partial<Record<Lang, Range[]>>;
type Texts = { cyrl: string; latn: string; ru: string };

/** AI tayyorlagan, admin tasdiqlashi kerak bo'lgan savol — `POST content/topics/:slug/questions` tanasi bilan bir xil. */
export interface PreparedQuestionDto {
  text: Texts;
  options: { text: Texts }[];
  correctIndex: number;
  explanation: Texts;
  keywords: { none: boolean; question: Ranges; answer: Ranges };
  /** Masalan: ruscha kalit so'z matndan topilmadi. */
  warnings: string[];
}

// Lotin apostrof variantlari bitta belgiga — qidiruvda farq qilmasin (uzunlik o'zgarmaydi).
const APOSTROPHES = /[ʻʼ‘’`']/g;

function fold(s: string): string {
  return [...s].map((c) => (c.toLowerCase().length === 1 ? c.toLowerCase() : c)).join("").replace(APOSTROPHES, "'");
}

/** Iboralarni matndan topib, kesishmaydigan oraliqlarga aylantiradi (katta-kichik harf farqsiz). */
export function locatePhrases(text: string, phrases: string[]): { ranges: Range[]; missing: string[] } {
  const hay = fold(text);
  const ranges: Range[] = [];
  const missing: string[] = [];
  for (const raw of phrases) {
    const phrase = raw.trim();
    if (!phrase) continue;
    const needle = fold(phrase);
    let found: Range | null = null;
    for (let from = 0; ; ) {
      const at = hay.indexOf(needle, from);
      if (at < 0) break;
      const candidate: Range = [at, at + needle.length];
      if (!ranges.some(([s, e]) => candidate[0] < e && s < candidate[1])) {
        found = candidate;
        break;
      }
      from = at + 1;
    }
    if (found) ranges.push(found);
    else missing.push(phrase);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  return { ranges, missing };
}

const isCyrillic = (s: string) => /[Ѐ-ӿ]/.test(s);

@Injectable()
export class QuestionCreateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly editor: QuestionEditorService,
    private readonly ai: AiService,
  ) {}

  /** Kun mavzusi (kurs) — "Yangi testlar" to'plamlari bu yerda emas. */
  private async courseTopic(slug: string) {
    const topic = await this.prisma.topic.findUnique({ where: { slug }, select: { id: true, slug: true, kind: true, deletedAt: true } });
    if (!topic || topic.deletedAt || topic.kind !== "course") throw new NotFoundException("Mavzu topilmadi");
    this.editor.assertEditable(topic);
    return topic;
  }

  /**
   * Admin lotinda yozgan savol → AI kirill yozuvi, ruscha tarjima va (tanlansa)
   * kalit so'zlar. Hech narsa saqlanmaydi: natijani admin ko'rib tasdiqlaydi.
   */
  async prepare(admin: AdminUser, slug: string, input: PrepareQuestionDto): Promise<PreparedQuestionDto> {
    await this.courseTopic(slug);
    const text = input.text.trim();
    const options = input.options.map((o) => o.trim());
    const explanation = (input.explanation ?? "").trim();
    if (!text) throw new BadRequestException("Savol matnini yozing");
    const empty = options.findIndex((o) => !o);
    if (empty >= 0) throw new BadRequestException(`${empty + 1}-variant matnini yozing`);
    if (input.correctIndex < 0 || input.correctIndex >= options.length) throw new BadRequestException("To'g'ri javobni belgilang");
    if (isCyrillic(text) || options.some(isCyrillic)) throw new BadRequestException("Savol va variantlarni lotin yozuvida yozing");

    const mode = input.keywords.mode;
    const correctLatn = options[input.correctIndex];
    let manual: Ranges = {};
    let manualAnswer: Ranges = {};
    if (mode === "manual") {
      manual = validateRanges({ uz: input.keywords.question ?? [] }, { cyrl: "", latn: text, ru: "" }, "Savol kaliti");
      manualAnswer = validateRanges({ uz: input.keywords.answer ?? [] }, { cyrl: "", latn: correctLatn, ru: "" }, "Javob kaliti");
      if (!manual.uz || !manualAnswer.uz) throw new BadRequestException("Savol kalitini ham, javob kalitini ham belgilang (yoki \"AI tanlasin\"ni tanlang)");
    }
    const slices = (s: string, r: Range[] | undefined) => (r ?? []).map(([a, b]) => s.slice(a, b));

    const ai = await this.ai.prepareQuestion(
      {
        text,
        options,
        correctIndex: input.correctIndex,
        explanation,
        keywords: mode === "ai" ? null : { question: slices(text, manual.uz), answer: slices(correctLatn, manualAnswer.uz) },
      },
      { adminId: admin.id },
    );

    // AI kirill o'rniga lotin qaytarsa — qoidaviy transliteratsiya.
    const cyrl = (latn: string, fromAi: string) => (fromAi.trim() && isCyrillic(fromAi) ? fromAi.trim() : latinToCyrillic(latn));
    const texts: Texts = { latn: text, cyrl: cyrl(text, ai.cyrl.text), ru: ai.ru.text.trim() };
    const optionTexts: Texts[] = options.map((o, i) => ({ latn: o, cyrl: cyrl(o, ai.cyrl.options[i]), ru: ai.ru.options[i].trim() }));
    const explanationTexts: Texts = explanation ? { latn: explanation, cyrl: cyrl(explanation, ai.cyrl.explanation), ru: ai.ru.explanation.trim() } : { latn: "", cyrl: "", ru: "" };

    const warnings: string[] = [];
    const keywords = { none: false, question: {} as Ranges, answer: {} as Ranges };
    const correct = optionTexts[input.correctIndex];
    const parts = [
      { part: "question" as const, label: "Savol", texts, phrases: ai.keywords.question, own: manual.uz },
      { part: "answer" as const, label: "Javob", texts: correct, phrases: ai.keywords.answer, own: manualAnswer.uz },
    ];
    for (const p of parts) {
      for (const lang of ["uz", "cyrl", "ru"] as Lang[]) {
        if (lang === "uz" && mode === "manual") {
          if (p.own) keywords[p.part].uz = p.own;
          continue;
        }
        const source = lang === "uz" ? p.texts.latn : lang === "cyrl" ? p.texts.cyrl : p.texts.ru;
        const { ranges, missing } = locatePhrases(source, p.phrases[lang]);
        if (ranges.length) keywords[p.part][lang] = ranges;
        if (missing.length) warnings.push(`${p.label} kaliti (${lang === "uz" ? "lotin" : lang === "cyrl" ? "kirill" : "rus"}) matndan topilmadi: ${missing.join(", ")}`);
      }
    }
    // Kalit so'zsiz savol saytga chiqmaydi — AI topa olmasa admin o'zi belgilaydi.
    if (!Object.keys(keywords.question).length || !Object.keys(keywords.answer).length) {
      throw new BadRequestException({
        statusCode: 400,
        code: "KEYWORDS_NOT_FOUND",
        message: "AI savol yoki javob kalitini topa olmadi — \"O'zim belgilayman\"ni tanlab, kalit so'zni lotin matnda belgilang",
      });
    }
    return { text: texts, options: optionTexts.map((t) => ({ text: t })), correctIndex: input.correctIndex, explanation: explanationTexts, keywords, warnings };
  }

  /** Admin tasdiqlagan savol mavzu testi oxiriga qo'shiladi va darhol saytda ko'rinadi. */
  async create(admin: AdminUser, ip: string, slug: string, input: QuestionInputDto): Promise<EditableQuestionDto> {
    const topic = await this.courseTopic(slug);
    // Admin tasdiqlash oynasida uchala tilni ko'rgan — ruscha tekshirilgan hisoblanadi.
    return this.editor.create(admin, ip, topic.id, input, { ruNeedsReview: false });
  }
}
