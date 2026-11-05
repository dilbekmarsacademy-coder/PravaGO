import { HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { z, type ZodType } from "zod";
import { PrismaService } from "../prisma/prisma.service";
import { budgetState, type BudgetState } from "./ai-budget";
import { costUsd, modelFor, type AiFeature } from "./ai-models";

// Claude (Anthropic API) bilan barcha chaqiruvlar shu yerda: model funksiya
// bo'yicha (env), retry (429/5xx — eksponensial kutish), timeout, javobni zod
// bilan tekshirish, har bir chaqiruv ai_usage jadvaliga (model, tokenlar, narx)
// va oylik budjet nazorati. ANTHROPIC_API_KEY bo'lmasa AI qismlari "sozlanmagan".
// Kalit hech qayerga yozilmaydi va log qilinmaydi. Shaxsiy ma'lumot (ism,
// telefon) bu servisga hech qachon uzatilmaydi.

export interface ImageBox {
  /** 0..1 — rasm kengligi/balandligiga nisbatan. */
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface RuTranslation {
  text: string;
  options: string[];
  explanation: string;
}

/** Xarajat kimga/nimaga tegishli (ai_usage). */
export interface UsageMeta {
  batchId?: string | null;
  adminId?: string | null;
  userId?: string | null;
}

export type Effort = "low" | "medium" | "high";

const BOXES_SCHEMA = {
  type: "object",
  properties: {
    boxes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
          w: { type: "number" },
          h: { type: "number" },
          label: { type: "string" },
        },
        required: ["x", "y", "w", "h", "label"],
        additionalProperties: false,
      },
    },
  },
  required: ["boxes"],
  additionalProperties: false,
} as const;

const TRANSLATION_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    explanation: { type: "string" },
  },
  required: ["text", "options", "explanation"],
  additionalProperties: false,
} as const;

const TEXTS_SCHEMA = {
  type: "object",
  properties: { text: { type: "string" }, options: { type: "array", items: { type: "string" } }, explanation: { type: "string" } },
  required: ["text", "options", "explanation"],
  additionalProperties: false,
} as const;

const PHRASES_SCHEMA = {
  type: "object",
  properties: {
    uz: { type: "array", items: { type: "string" } },
    cyrl: { type: "array", items: { type: "string" } },
    ru: { type: "array", items: { type: "string" } },
  },
  required: ["uz", "cyrl", "ru"],
  additionalProperties: false,
} as const;

const PREPARED_SCHEMA = {
  type: "object",
  properties: {
    cyrl: TEXTS_SCHEMA,
    ru: TEXTS_SCHEMA,
    keywords: {
      type: "object",
      properties: { question: PHRASES_SCHEMA, answer: PHRASES_SCHEMA },
      required: ["question", "answer"],
      additionalProperties: false,
    },
  },
  required: ["cyrl", "ru", "keywords"],
  additionalProperties: false,
} as const;

const BoxesZ = z.object({ boxes: z.array(z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number(), label: z.string() })) });
const TranslationZ = z.object({ text: z.string(), options: z.array(z.string()), explanation: z.string() });
const PhrasesZ = z.object({ uz: z.array(z.string()), cyrl: z.array(z.string()), ru: z.array(z.string()) });
const PreparedZ = z.object({ cyrl: TranslationZ, ru: TranslationZ, keywords: z.object({ question: PhrasesZ, answer: PhrasesZ }) });

/** Lotincha savolning AI tayyorlagan kirill va ruscha matni hamda kalit so'z iboralari (har tilda matndan aynan ko'chirilgan). */
export type PreparedQuestion = z.infer<typeof PreparedZ>;

export interface PrepareQuestionInput {
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  /** Admin belgilagan lotincha kalit bo'laklar; `null` — kalit so'zni AI tanlaydi. */
  keywords: { question: string[]; answer: string[] } | null;
}

export const PREPARE_SYSTEM =
  "You prepare Uzbek driving-licence exam questions (traffic rules of Uzbekistan) that an admin typed in Uzbek Latin script. Return:\n" +
  "1) cyrl — the same text in Uzbek Cyrillic script using official orthography: oʻ/o' → ў, gʻ/g' → ғ, sh → ш, ch → ч, yo → ё, yu → ю, ya → я, ye/word-initial e → е/э as correct, ' (tutuq belgisi) → ъ, " +
  "Russian loanwords keep their Russian spelling (sentabr → сентябрь, tsirk → цирк, avtomobil → автомобиль). Do not translate, only change the script.\n" +
  "2) ru — a Russian translation in the wording of the official Russian-language traffic rules (ПДД) of Uzbekistan.\n" +
  "In both: preserve the exact meaning; keep every number, sign number (e.g. 3.24, 5.15.1), unit, letter label (А, В, C) unchanged; return the same number of options in the same order; empty explanation stays empty.\n" +
  "3) keywords — key phrases that help a student remember the correct answer: `question` from the question text, `answer` from the correct option text (correctIndex, 0-based). " +
  "Each phrase must be copied EXACTLY (same letters, same case) from the corresponding text in that language: uz from the Latin input, cyrl from your cyrl text, ru from your ru text. " +
  "If keywords are given in the input (Latin fragments), return them unchanged as uz and give the matching fragments of the cyrl and ru texts in the same order. " +
  "If keywords is null, choose them yourself: 1–4 words each, the decisive words of the question and of the correct answer; uz, cyrl and ru must mean the same thing. " +
  "Use empty arrays when there is no sensible key phrase.";

/** Standart: bitta so'rov Vercel'dagi bitta qadamga (40 s) sig'ishi uchun. */
const DEFAULT_TIMEOUT_MS = 35_000;
const RETRY_BASE_MS = 800;

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** Server tomonidagi zaxira model (refusal) — faqat shu modellarda (Claude API). */
function supportsFallback(model: string): boolean {
  return model === "claude-sonnet-5-5" || model === "claude-opus-5-5";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Qayta urinish mumkin bo'lgan xato: 429, 5xx (529 — overloaded), ulanish/timeout. */
export function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.APIConnectionError) return true;
  if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError) return true;
  return err instanceof Anthropic.APIError && typeof err.status === "number" && (err.status === 429 || err.status >= 500);
}

/** Hisobda mablag' yoki chegara tugagan (billing). */
export function isBillingError(err: unknown): boolean {
  if (!(err instanceof Anthropic.APIError)) return false;
  if (err.status === 402) return true;
  const type = (err.error as { error?: { type?: string } } | undefined)?.error?.type;
  return type === "billing_error" || /credit balance|billing|spend limit|usage limit/i.test(err.message);
}

/** API xatosini adminga tushunarli xabarga aylantirish. */
export function toAiHttpError(err: unknown): HttpException {
  if (err instanceof HttpException) return err;
  if (isBillingError(err)) {
    return new ServiceUnavailableException({
      statusCode: 503,
      code: "AI_BILLING",
      message: "Anthropic hisobida mablag' tugagan yoki xarajat chegarasiga yetilgan. console.anthropic.com → Billing bo'limini tekshiring.",
    });
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new ServiceUnavailableException({ statusCode: 503, code: "AI_AUTH", message: "AI kaliti (ANTHROPIC_API_KEY) yaroqsiz yoki ruxsat yo'q" });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new HttpException({ statusCode: 429, code: "AI_RATE_LIMITED", message: "AI hozir band (so'rovlar chegarasi). Birozdan keyin qayta urinib ko'ring." }, HttpStatus.TOO_MANY_REQUESTS);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new ServiceUnavailableException({ statusCode: 503, code: "AI_TIMEOUT", message: "AI javob bermadi (vaqt tugadi yoki ulanish yo'q) — qayta urinib ko'ring" });
  }
  if (err instanceof Anthropic.APIError) {
    return new ServiceUnavailableException({ statusCode: 503, code: "AI_ERROR", message: `AI xatosi (${err.status ?? "?"})` });
  }
  return new ServiceUnavailableException({ statusCode: 503, code: "AI_ERROR", message: err instanceof Error ? err.message.slice(0, 300) : "AI xatosi" });
}

type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  run: (input: Record<string, unknown>) => Promise<unknown>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic | null = null;

  constructor(private readonly prisma: PrismaService) {}

  configured(): boolean {
    return aiConfigured();
  }

  budget(): Promise<BudgetState> {
    return budgetState(this.prisma);
  }

  private api(): Anthropic {
    if (!aiConfigured()) {
      throw new ServiceUnavailableException({ statusCode: 503, code: "AI_NOT_CONFIGURED", message: "AI sozlanmagan (ANTHROPIC_API_KEY yo'q)" });
    }
    // Retry o'zimizda — har bir urinish ai_usage'ga yoziladi.
    // Vercel env qiymati oxirida bo'sh joy yoki yangi qator bo'lsa ham kalit buzilmasin.
    this.client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim(), maxRetries: 0 });
    return this.client;
  }

  /** 100% budjet — yangi AI chaqiruvlari to'xtaydi (mavjud kesh ko'rsatilaveradi). */
  async assertBudget(): Promise<void> {
    const state = await this.budget();
    if (state.level === "blocked") {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: "AI_BUDGET_EXCEEDED",
        message: `Oylik AI budjeti ($${state.budgetUsd.toFixed(2)}) tugadi: shu oy $${state.spentUsd.toFixed(2)} sarflandi. Yangi importlar va xulosalar keyingi oygacha to'xtatildi (AI_MONTHLY_BUDGET_USD ni oshirish mumkin).`,
      });
    }
  }

  private async record(feature: AiFeature, model: string, usage: Usage | null, meta: UsageMeta | undefined, error?: unknown): Promise<void> {
    const tokens = {
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
      cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
    };
    await this.prisma.aiUsage
      .create({
        data: {
          feature,
          model,
          ...tokens,
          costUsd: costUsd(model, tokens),
          ok: !error,
          error: error ? (error instanceof Error ? error.message : String(error)).slice(0, 500) : null,
          batchId: meta?.batchId ?? null,
          adminId: meta?.adminId ?? null,
          userId: meta?.userId ?? null,
        },
      })
      .catch((err: unknown) => this.logger.warn(`ai_usage yozilmadi: ${err instanceof Error ? err.message : String(err)}`));
  }

  /** Bitta so'rov — retry bilan; har bir urinish (xato ham) ai_usage'ga yoziladi. */
  private async call(feature: AiFeature, params: Record<string, unknown>, opts: { meta?: UsageMeta; timeoutMs?: number; attempts?: number }): Promise<Anthropic.Beta.BetaMessage> {
    await this.assertBudget();
    const model = modelFor(feature);
    const attempts = opts.attempts ?? 3;
    const body = {
      model,
      ...(supportsFallback(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
      ...params,
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming;
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await this.api().beta.messages.create(body, { timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS });
        await this.record(feature, response.model ?? model, response.usage, opts.meta);
        if (response.stop_reason === "refusal") throw new ServiceUnavailableException({ statusCode: 503, code: "AI_REFUSED", message: "AI so'rovni rad etdi" });
        return response;
      } catch (err) {
        lastError = err;
        if (err instanceof HttpException) throw err;
        await this.record(feature, model, null, opts.meta, err);
        if (!isRetryable(err) || attempt === attempts) break;
        const retryAfter = err instanceof Anthropic.APIError ? Number(err.headers?.get?.("retry-after")) : NaN;
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 8000) : RETRY_BASE_MS * 2 ** (attempt - 1) + Math.random() * 300);
      }
    }
    throw toAiHttpError(lastError);
  }

  private static text(response: Anthropic.Beta.BetaMessage): string {
    return response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  }

  /**
   * Strukturali javob: JSON schema (output_config.format) + zod tekshiruvi.
   * Katta, takrorlanadigan system prompt keshlanadi (cache_control).
   */
  async json<T>(params: {
    feature: AiFeature;
    system: string;
    content: Anthropic.Beta.BetaContentBlockParam[];
    schema: object;
    validate: ZodType<T>;
    effort?: Effort;
    maxTokens?: number;
    meta?: UsageMeta;
    timeoutMs?: number;
    attempts?: number;
  }): Promise<T> {
    const response = await this.call(
      params.feature,
      {
        max_tokens: params.maxTokens ?? 8000,
        system: [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }],
        output_config: { effort: params.effort ?? "low", format: { type: "json_schema", schema: params.schema as Record<string, unknown> } },
        messages: [{ role: "user", content: params.content }],
      },
      { meta: params.meta, timeoutMs: params.timeoutMs, attempts: params.attempts },
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(AiService.text(response));
    } catch {
      throw new ServiceUnavailableException({ statusCode: 503, code: "AI_BAD_RESPONSE", message: "AI javobi JSON emas" });
    }
    const result = params.validate.safeParse(parsed);
    if (!result.success) {
      throw new ServiceUnavailableException({ statusCode: 503, code: "AI_BAD_RESPONSE", message: `AI javobi kutilgan ko'rinishda emas: ${result.error.issues[0]?.message ?? ""}` });
    }
    return result.data;
  }

  /** Erkin matnli javob (statistika tahlili, o'quvchi xulosasi). */
  async text(params: { feature: AiFeature; system: string; messages: Anthropic.Beta.BetaMessageParam[]; effort?: Effort; maxTokens?: number; meta?: UsageMeta }): Promise<{ text: string; model: string; inputTokens: number; outputTokens: number }> {
    const response = await this.call(
      params.feature,
      {
        max_tokens: params.maxTokens ?? 4000,
        system: [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }],
        output_config: { effort: params.effort ?? "low" },
        messages: params.messages,
      },
      { meta: params.meta },
    );
    return { text: AiService.text(response), model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  }

  /**
   * Tool use sikli ("Statistikadan so'rash"): AI faqat berilgan, o'qiydigan
   * funksiyalarni chaqira oladi. Qaysi funksiyalar chaqirilgani qaytariladi.
   */
  async withTools(params: { feature: AiFeature; system: string; question: string; tools: ToolSpec[]; meta?: UsageMeta; maxTurns?: number }): Promise<{ text: string; calls: { name: string; input: unknown }[] }> {
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: params.question }];
    const calls: { name: string; input: unknown }[] = [];
    const tools = params.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema, strict: true }));
    for (let turn = 0; turn < (params.maxTurns ?? 4); turn++) {
      const response = await this.call(
        params.feature,
        {
          max_tokens: 4000,
          system: [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }],
          output_config: { effort: "low" },
          tools,
          tool_choice: { type: "auto" },
          messages,
        },
        { meta: params.meta },
      );
      messages.push({ role: "assistant", content: response.content as unknown as Anthropic.Beta.BetaContentBlockParam[] });
      const uses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (response.stop_reason !== "tool_use" || uses.length === 0) return { text: AiService.text(response), calls };
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const use of uses) {
        const tool = params.tools.find((t) => t.name === use.name);
        calls.push({ name: use.name, input: use.input });
        try {
          const output = tool ? await tool.run((use.input ?? {}) as Record<string, unknown>) : { error: "noma'lum funksiya" };
          results.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(output) });
        } catch (err) {
          results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: err instanceof Error ? err.message : "xato" });
        }
      }
      messages.push({ role: "user", content: results });
    }
    return { text: "Javobni yakunlab bo'lmadi — savolni aniqroq yozing.", calls };
  }

  /** Watermark, logotip va keraksiz yozuvlar koordinatalari (yo'l harakati belgilari va savol mazmuni EMAS). */
  async detectWatermarks(jpeg: Buffer, meta?: UsageMeta, feature: AiFeature = "watermark"): Promise<ImageBox[]> {
    const result = await this.json({
      feature,
      system: WATERMARK_SYSTEM,
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
        { type: "text", text: "List the watermark/logo/unwanted-text boxes in this image." },
      ],
      schema: BOXES_SCHEMA,
      validate: BoxesZ,
      effort: "low",
      maxTokens: 4000,
      meta,
    });
    return result.boxes
      .map((b) => ({ ...b, x: clamp01(b.x), y: clamp01(b.y), w: clamp01(b.w), h: clamp01(b.h) }))
      .filter((b) => b.w > 0.002 && b.h > 0.002 && b.w * b.h < 0.5);
  }

  /** O'zbekcha savolni ruschaga tarjima: qoidalar mazmuni, raqamlar, belgi raqamlari va birliklar o'zgarmaydi. */
  async translateToRussian(input: { text: string; options: string[]; explanation: string }, meta?: UsageMeta): Promise<RuTranslation> {
    const result = await this.json({
      feature: "translate",
      system:
        "You translate Uzbek driving-licence exam questions into Russian as used in official Russian-language traffic rules (ПДД) of Uzbekistan. " +
        "Preserve the exact meaning of the rule. Keep every number, sign number (e.g. 3.24, 5.15.1), unit (km/h, m, t), letter label (А, В, C) and option order unchanged. " +
        "Do not add or remove information. Return the same number of options in the same order. Empty explanation stays empty.",
      content: [{ type: "text", text: JSON.stringify(input) }],
      schema: TRANSLATION_SCHEMA,
      validate: TranslationZ,
      effort: "medium",
      maxTokens: 8000,
      meta,
    });
    if (result.options.length !== input.options.length) throw new Error("Tarjimada variantlar soni mos emas");
    return result;
  }

  /** Admin lotinda yozgan yangi savol: kirill yozuvi, ruscha tarjima va kalit so'z iboralari bitta so'rovda. */
  async prepareQuestion(input: PrepareQuestionInput, meta?: UsageMeta): Promise<PreparedQuestion> {
    const result = await this.json({
      feature: "translate",
      system: PREPARE_SYSTEM,
      content: [{ type: "text", text: JSON.stringify(input) }],
      schema: PREPARED_SCHEMA,
      validate: PreparedZ,
      effort: "medium",
      maxTokens: 8000,
      meta,
    });
    if (result.cyrl.options.length !== input.options.length || result.ru.options.length !== input.options.length) {
      throw new ServiceUnavailableException({ statusCode: 503, code: "AI_BAD_RESPONSE", message: "AI javobida variantlar soni mos emas — qaytadan urinib ko'ring" });
    }
    return result;
  }
}

export const WATERMARK_SYSTEM =
  "You inspect images used in driving-licence exam questions (road scenes, road signs, vehicles, diagrams). " +
  "Find ONLY overlays that are not part of the question: watermarks, website/channel logos, URLs, phone numbers, " +
  "copyright text, app UI captions, stray labels added on top of the picture. Never mark road signs, traffic lights, " +
  "vehicles, road markings, arrows or letters/numbers that belong to the exam scene. " +
  "Return tight bounding boxes as fractions of image width/height (x, y = top-left corner). Return an empty list if none.";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
}
