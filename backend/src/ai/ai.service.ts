import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";

// Claude (Anthropic API) bilan barcha chaqiruvlar shu yerda. ANTHROPIC_API_KEY
// bo'lmasa AI qismlari "sozlanmagan" — qolgan funksiyalar ishlayveradi.
// Shaxsiy ma'lumot (ism, telefon) bu servisga hech qachon uzatilmaydi.

export const AI_MODEL = "claude-opus-5-5";

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

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic | null = null;

  configured(): boolean {
    return aiConfigured();
  }

  private api(): Anthropic {
    if (!aiConfigured()) {
      throw new ServiceUnavailableException({ statusCode: 503, code: "AI_NOT_CONFIGURED", message: "AI sozlanmagan (ANTHROPIC_API_KEY yo'q)" });
    }
    this.client ??= new Anthropic();
    return this.client;
  }

  /** Strukturali javob (JSON schema) — matn blokidan o'qiladi. */
  private async json<T>(params: { system: string; content: Anthropic.Beta.BetaContentBlockParam[]; schema: object; effort: "low" | "medium" | "high"; maxTokens: number }): Promise<T> {
    const response = await this.api().beta.messages.create({
      model: AI_MODEL,
      max_tokens: params.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: params.system,
      output_config: { effort: params.effort, format: { type: "json_schema", schema: params.schema as Record<string, unknown> } },
      messages: [{ role: "user", content: params.content }],
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);
    if (response.stop_reason === "refusal") throw new Error("AI so'rovni rad etdi");
    const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text ?? "";
    return JSON.parse(text) as T;
  }

  /** Watermark, logotip va keraksiz yozuvlar koordinatalari (yo'l harakati belgilari va savol mazmuni EMAS). */
  async detectWatermarks(jpeg: Buffer): Promise<ImageBox[]> {
    const result = await this.json<{ boxes: ImageBox[] }>({
      system:
        "You inspect images used in driving-licence exam questions (road scenes, road signs, vehicles, diagrams). " +
        "Find ONLY overlays that are not part of the question: watermarks, website/channel logos, URLs, phone numbers, " +
        "copyright text, app UI captions, stray labels added on top of the picture. Never mark road signs, traffic lights, " +
        "vehicles, road markings, arrows or letters/numbers that belong to the exam scene. " +
        "Return tight bounding boxes as fractions of image width/height (x, y = top-left corner). Return an empty list if none.",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
        { type: "text", text: "List the watermark/logo/unwanted-text boxes in this image." },
      ],
      schema: BOXES_SCHEMA,
      effort: "low",
      maxTokens: 4000,
    });
    return result.boxes
      .map((b) => ({ ...b, x: clamp01(b.x), y: clamp01(b.y), w: clamp01(b.w), h: clamp01(b.h) }))
      .filter((b) => b.w > 0.002 && b.h > 0.002 && b.w * b.h < 0.5);
  }

  /** O'zbekcha savolni ruschaga tarjima: qoidalar mazmuni, raqamlar, belgi raqamlari va birliklar o'zgarmaydi. */
  async translateToRussian(input: { text: string; options: string[]; explanation: string }): Promise<RuTranslation> {
    const result = await this.json<RuTranslation>({
      system:
        "You translate Uzbek driving-licence exam questions into Russian as used in official Russian-language traffic rules (ПДД) of Uzbekistan. " +
        "Preserve the exact meaning of the rule. Keep every number, sign number (e.g. 3.24, 5.15.1), unit (km/h, m, t), letter label (А, В, C) and option order unchanged. " +
        "Do not add or remove information. Return the same number of options in the same order. Empty explanation stays empty.",
      content: [{ type: "text", text: JSON.stringify(input) }],
      schema: TRANSLATION_SCHEMA,
      effort: "medium",
      maxTokens: 8000,
    });
    if (result.options.length !== input.options.length) throw new Error("Tarjimada variantlar soni mos emas");
    return result;
  }

  /** Erkin matnli javob (statistika tahlili, savol-javob). */
  async text(system: string, messages: Anthropic.MessageParam[], effort: "low" | "medium" | "high" = "medium"): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const stream = this.api().beta.messages.stream({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      output_config: { effort },
      messages,
    } as Anthropic.Beta.MessageCreateParamsStreaming);
    const response = await stream.finalMessage();
    if (response.stop_reason === "refusal") throw new Error("AI so'rovni rad etdi");
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    this.logger.log(`AI javob: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);
    return { text, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
}
