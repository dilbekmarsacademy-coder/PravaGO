// AI import qadamlari: prompt, JSON schema (structured output) va zod tekshiruvi.
// Barchasi AiService.json orqali (retry, ai_usage, budjet). Shaxsiy ma'lumot yuborilmaydi.

import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { AiService, UsageMeta } from "../ai/ai.service";
import type { FileClassification } from "./types";

type Content = Anthropic.Beta.BetaContentBlockParam;

// ── 1. Fayl tasnifi (AI_MODEL_FAST) ──

const CLASSIFY_SYSTEM = `You classify files uploaded to build driving-licence exam tests (Uzbekistan, "6+1 day" course: days 1–6, each day has numbered topics).
Files are in Uzbek (Cyrillic or Latin script) or Russian. You get the file name, a deterministic parse summary and the beginning of the text.
Decide the file kind:
- questions_full: questions with options AND correct answers (and often images)
- questions_only: questions with options but no correct answers
- keys_only: only keywords and/or answers (answer tables like "1–F2", "Savol kaliti", "KALIT → JAVOB KALITI") without full options
- mixed: several of the above
- unrelated: not exam test material (e.g. a contract, a price list)
List every day/topic found (numbers and the topic title as written). Count questions. Do not invent topics that are not in the text.`;

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["questions_full", "questions_only", "keys_only", "mixed", "unrelated"] },
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: { day: { anyOf: [{ type: "integer" }, { type: "null" }] }, topicNumber: { anyOf: [{ type: "integer" }, { type: "null" }] }, title: { anyOf: [{ type: "string" }, { type: "null" }] } },
        required: ["day", "topicNumber", "title"],
        additionalProperties: false,
      },
    },
    questionCount: { type: "integer" },
    script: { type: "string", enum: ["cyrl", "latn", "mixed"] },
    language: { type: "string", enum: ["uz", "ru", "other"] },
    reason: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["kind", "topics", "questionCount", "script", "language", "reason"],
  additionalProperties: false,
} as const;

const ClassifyZ = z.object({
  kind: z.enum(["questions_full", "questions_only", "keys_only", "mixed", "unrelated"]),
  topics: z.array(z.object({ day: z.number().int().nullable(), topicNumber: z.number().int().nullable(), title: z.string().nullable() })),
  questionCount: z.number().int(),
  script: z.enum(["cyrl", "latn", "mixed"]),
  language: z.enum(["uz", "ru", "other"]),
  reason: z.string().nullable(),
});

export async function classifyFile(ai: AiService, input: { name: string; summary: unknown; preview: string }, meta: UsageMeta): Promise<FileClassification> {
  const result = await ai.json({
    feature: "import.classify",
    system: CLASSIFY_SYSTEM,
    content: [{ type: "text", text: `File: ${input.name}\nParse summary: ${JSON.stringify(input.summary)}\n\nText (beginning):\n${input.preview.slice(0, 3500)}` }],
    schema: CLASSIFY_SCHEMA,
    validate: ClassifyZ,
    effort: "low",
    maxTokens: 2000,
    meta,
  });
  return { ...result, source: "ai" };
}

// ── 2. Savollar tahlili (AI_MODEL_PARSE) ──

export const ANALYZE_SYSTEM = `You are an expert on Uzbekistan's road traffic rules (Yo'l harakati qoidalari, YHQ) checking driving-licence exam questions before they are published.
For EACH question you get its id, the original text and options (Uzbek, Cyrillic or Latin), and what the deterministic file parser found: the correct option (fileAnswer, 0-based) and keywords from the files. Some questions have an image (given right before the question as an image block labelled with the question id) — use it when the answer depends on the picture.
Return one result per question id:
- correctIndex: the correct option (0-based). If fileAnswer is given, KEEP it as correctIndex even if you disagree; then set doubt to a short reason (in Uzbek, Latin script). If fileAnswer is null, give your best answer and set guessReason (short, Uzbek Latin).
- questionKey: the key phrase copied EXACTLY (same script, same spelling) from the question text, 1–4 words; answerKey: the key phrase copied EXACTLY from the correct option text, 1–4 words. If keywords from files are given, return them unchanged. If you cannot find a good phrase, return null.
- explanation: 1–2 short sentences in Uzbek (Latin script) explaining why the answer is correct (cite the rule idea, no invented rule numbers).
- ru: Russian translation (text, options in the same order, explanation) as used in the official Russian-language traffic rules of Uzbekistan. Keep numbers, sign numbers (e.g. 3.24), units and letter labels unchanged.
- confidence: high | medium | low; problems: short list (Uzbek Latin) of issues (unclear image, options look wrong, duplicated options, text cut off ...). Empty list if none.
Never change the original question text or options.`;

const ANALYZE_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          correctIndex: { type: "integer" },
          doubt: { anyOf: [{ type: "string" }, { type: "null" }] },
          guessReason: { anyOf: [{ type: "string" }, { type: "null" }] },
          questionKey: { anyOf: [{ type: "string" }, { type: "null" }] },
          answerKey: { anyOf: [{ type: "string" }, { type: "null" }] },
          explanation: { type: "string" },
          ru: {
            type: "object",
            properties: { text: { type: "string" }, options: { type: "array", items: { type: "string" } }, explanation: { type: "string" } },
            required: ["text", "options", "explanation"],
            additionalProperties: false,
          },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          problems: { type: "array", items: { type: "string" } },
        },
        required: ["id", "correctIndex", "doubt", "guessReason", "questionKey", "answerKey", "explanation", "ru", "confidence", "problems"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

const AnalyzeZ = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      correctIndex: z.number().int(),
      doubt: z.string().nullable(),
      guessReason: z.string().nullable(),
      questionKey: z.string().nullable(),
      answerKey: z.string().nullable(),
      explanation: z.string(),
      ru: z.object({ text: z.string(), options: z.array(z.string()), explanation: z.string() }),
      confidence: z.enum(["high", "medium", "low"]),
      problems: z.array(z.string()),
    }),
  ),
});

export type AnalyzeResult = z.infer<typeof AnalyzeZ>["results"][number];

export interface AnalyzeInput {
  id: string;
  text: string;
  options: string[];
  fileAnswer: number | null;
  fileKeys: { question: string | null; answer: string | null } | null;
  image: { data: Buffer } | null;
}

export async function analyzeQuestions(ai: AiService, items: AnalyzeInput[], meta: UsageMeta): Promise<AnalyzeResult[]> {
  const content: Content[] = [];
  for (const item of items) {
    if (item.image) {
      content.push({ type: "text", text: `Image for question id=${item.id}:` });
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: item.image.data.toString("base64") } });
    }
  }
  content.push({
    type: "text",
    text: JSON.stringify(
      items.map((i) => ({ id: i.id, text: i.text, options: i.options, fileAnswer: i.fileAnswer, fileKeys: i.fileKeys, hasImage: Boolean(i.image) })),
      null,
      1,
    ),
  });
  const result = await ai.json({ feature: "import.analyze", system: ANALYZE_SYSTEM, content, schema: ANALYZE_SCHEMA, validate: AnalyzeZ, effort: "medium", maxTokens: 12000, meta, timeoutMs: 38_000, attempts: 2 });
  return result.results;
}

// ── 2b. Ekran rasmidan savolni o'qish (AI_MODEL_PARSE, vision) ──

const SCREEN_SYSTEM = `You read screenshots of a driving-licence exam application (Uzbekistan). A screenshot shows one exam question: the question text (usually on a coloured bar at the top), an illustration (road scene, sign, diagram) — sometimes none — and the answer options (labelled F1, F2 ... or similar). The correct option is highlighted (usually a green background).
Transcribe EXACTLY what is written: same script (Uzbek Cyrillic/Latin or Russian), same spelling and punctuation (keep «», quotes, numbers, sign numbers). Do not translate, do not fix typos, do not add the "F1" labels to option texts.
Return:
- isQuestion: false if the image is not an exam question screen (then other fields may be empty).
- number: the current question number if visible (e.g. the highlighted number in the question navigator), else null; ticket: the ticket (bilet) number if visible, else null.
- question, options (in the shown order).
- correctIndex: 0-based index of the GREEN option; null if no option is green. A red option is a previous wrong pick of the test taker — ignore it.
- picture: the bounding box in PIXELS of the given image (x, y = top-left) of the question illustration ONLY — exclude the app UI (buttons, timer, header bar, option list, navigator). null if the question has no illustration, or if that area shows an advertisement, the app's logo/placeholder or any picture that does not depict the question situation.
- problems: short list, in Uzbek LATIN script, ONLY of problems that affect publishing the question (text cut off or unreadable, no or several green options, illustration needed but missing). Do not mention the red pick, punctuation or layout. Empty if none.`;

const SCREEN_SCHEMA = {
  type: "object",
  properties: {
    isQuestion: { type: "boolean" },
    number: { anyOf: [{ type: "integer" }, { type: "null" }] },
    ticket: { anyOf: [{ type: "integer" }, { type: "null" }] },
    question: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    correctIndex: { anyOf: [{ type: "integer" }, { type: "null" }] },
    picture: {
      anyOf: [
        { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } }, required: ["x", "y", "w", "h"], additionalProperties: false },
        { type: "null" },
      ],
    },
    problems: { type: "array", items: { type: "string" } },
  },
  required: ["isQuestion", "number", "ticket", "question", "options", "correctIndex", "picture", "problems"],
  additionalProperties: false,
} as const;

const ScreenZ = z.object({
  isQuestion: z.boolean(),
  number: z.number().int().nullable(),
  ticket: z.number().int().nullable(),
  question: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number().int().nullable(),
  picture: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).nullable(),
  problems: z.array(z.string()),
});

/** Ekran rasmidan o'qilgan savol; `picture` — 0..1 nisbatda. */
export type ScreenResult = z.infer<typeof ScreenZ>;

export async function transcribeScreen(ai: AiService, jpeg: { data: Buffer; width: number; height: number }, meta: UsageMeta): Promise<ScreenResult> {
  const r = await ai.json({
    feature: "import.screens",
    system: SCREEN_SYSTEM,
    content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.data.toString("base64") } },
      { type: "text", text: `Image size: ${jpeg.width}×${jpeg.height} px. Transcribe this exam question screen.` },
    ],
    schema: SCREEN_SCHEMA,
    validate: ScreenZ,
    effort: "low",
    maxTokens: 3000,
    meta,
    timeoutMs: 38_000,
    attempts: 2,
  });
  const p = r.picture;
  const picture =
    p && p.w > 0 && p.h > 0
      ? { x: Math.max(0, p.x / jpeg.width), y: Math.max(0, p.y / jpeg.height), w: Math.min(1, p.w / jpeg.width), h: Math.min(1, p.h / jpeg.height) }
      : null;
  // Juda kichik "rasm" — ehtimol UI bo'lagi.
  return { ...r, picture: picture && picture.w > 0.08 && picture.h > 0.08 ? picture : null };
}

// ── 3. Shubhali juftliklarni tasdiqlash (AI_MODEL_PARSE) ──

const MATCH_SYSTEM = `You compare pairs of driving-licence exam questions taken from different files (Uzbek Cyrillic/Latin, maybe Russian). For each pair decide whether they are THE SAME question (same meaning, possibly different script, numbering or small wording differences). Answer only same: true/false per pair id.`;

const MATCH_SCHEMA = {
  type: "object",
  properties: { pairs: { type: "array", items: { type: "object", properties: { id: { type: "string" }, same: { type: "boolean" } }, required: ["id", "same"], additionalProperties: false } } },
  required: ["pairs"],
  additionalProperties: false,
} as const;

const MatchZ = z.object({ pairs: z.array(z.object({ id: z.string(), same: z.boolean() })) });

export async function confirmMatches(ai: AiService, pairs: { id: string; a: string; b: string }[], meta: UsageMeta): Promise<Map<string, boolean>> {
  const result = await ai.json({
    feature: "import.match",
    system: MATCH_SYSTEM,
    content: [{ type: "text", text: JSON.stringify(pairs) }],
    schema: MATCH_SCHEMA,
    validate: MatchZ,
    effort: "low",
    maxTokens: 2000,
    meta,
  });
  return new Map(result.pairs.map((p) => [p.id, p.same]));
}

// ── 4. Rasmlar: watermark joyi va tozalashni tekshirish (AI_MODEL_WATERMARK) ──

const WATERMARK_SYSTEM = `You inspect images used in driving-licence exam questions (road scenes, road signs, vehicles, diagrams).
Find ONLY overlays that are not part of the question: watermarks, website/channel logos, URLs, phone numbers, copyright text, app UI captions, stray labels added on top of the picture.
Never mark road signs, traffic lights, vehicles, road markings, arrows or letters/numbers that belong to the exam scene.
Return tight bounding boxes in PIXELS of the given image (x, y = top-left corner) and the background under each box: smooth (plain sky/road/flat colour) or complex (texture, objects, edges).`;

const WM_SCHEMA = {
  type: "object",
  properties: {
    boxes: {
      type: "array",
      items: {
        type: "object",
        properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" }, background: { type: "string", enum: ["smooth", "complex"] }, label: { type: "string" } },
        required: ["x", "y", "w", "h", "background", "label"],
        additionalProperties: false,
      },
    },
  },
  required: ["boxes"],
  additionalProperties: false,
} as const;

const WmZ = z.object({ boxes: z.array(z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number(), background: z.enum(["smooth", "complex"]), label: z.string() })) });

export interface PixelBox {
  x: number;
  y: number;
  w: number;
  h: number;
  background: "smooth" | "complex";
  label: string;
}

export async function detectWatermarkBoxes(ai: AiService, jpeg: { data: Buffer; width: number; height: number }, meta: UsageMeta, hint?: string): Promise<PixelBox[]> {
  const result = await ai.json({
    feature: "import.watermark",
    system: WATERMARK_SYSTEM,
    content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.data.toString("base64") } },
      { type: "text", text: `Image size: ${jpeg.width}×${jpeg.height} px.${hint ? ` Hint: ${hint}` : ""} List the watermark/logo/unwanted-text boxes (pixels). Empty list if none.` },
    ],
    schema: WM_SCHEMA,
    validate: WmZ,
    effort: "low",
    maxTokens: 3000,
    meta,
  });
  return result.boxes.filter((b) => b.w > 2 && b.h > 2 && (b.w * b.h) / (jpeg.width * jpeg.height) < 0.5);
}

const VERIFY_SYSTEM = `You check a driving-licence exam image AFTER watermark removal. Report whether any watermark, logo or overlay text residue is still visible, and whether there is a noticeable smudge/blur patch where something was removed that would distract a student. Be strict but ignore tiny artefacts.`;

const VERIFY_SCHEMA = {
  type: "object",
  properties: { residue: { type: "boolean" }, smudge: { type: "boolean" }, note: { anyOf: [{ type: "string" }, { type: "null" }] } },
  required: ["residue", "smudge", "note"],
  additionalProperties: false,
} as const;

const VerifyZ = z.object({ residue: z.boolean(), smudge: z.boolean(), note: z.string().nullable() });

export async function verifyCleaned(ai: AiService, jpeg: Buffer, meta: UsageMeta): Promise<z.infer<typeof VerifyZ>> {
  return ai.json({
    feature: "import.verify",
    system: VERIFY_SYSTEM,
    content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
      { type: "text", text: "Is any watermark residue or a distracting smudge visible?" },
    ],
    schema: VERIFY_SCHEMA,
    validate: VerifyZ,
    effort: "low",
    maxTokens: 1000,
    meta,
  });
}

/** Taxminiy narx (boshlashdan oldin): Sonnet tahlili, rasmlar (aniqlash + tekshirish), Haiku tasnifi. */
export function estimateCostUsd(input: { files: number; questions: number; questionsWithImage: number; images: number; watermarks: boolean; screens?: number }): number {
  const sonnet = (inTok: number, outTok: number) => (inTok * 2 + outTok * 10) / 1_000_000;
  const haiku = (inTok: number, outTok: number) => (inTok * 0.1 + outTok * 0.5) / 1_000_000;
  const classify = input.files * haiku(3000, 300);
  const analyze = input.questions * sonnet(450, 380) + input.questionsWithImage * sonnet(1100, 0);
  const images = input.watermarks ? input.images * (sonnet(1300, 150) * 2) : 0;
  const matching = Math.ceil(input.questions / 10) * sonnet(600, 100);
  // Ekran rasmlari: o'qish (vision) + keyingi tahlil va kesilgan rasm.
  const n = input.screens ?? 0;
  const screens = n * sonnet(1700, 450) + n * (sonnet(450, 380) + sonnet(800, 0)) + (input.watermarks ? n * sonnet(900, 150) * 2 : 0);
  return Math.round((classify + analyze + images + matching + screens) * 1.15 * 1000) / 1000;
}
