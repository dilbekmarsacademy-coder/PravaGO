// AI funksiyalari, ularning modellari (env orqali alohida o'zgartiriladi) va narxlari.
// Narxlar — Anthropic API ($ / 1 mln token); keshga yozish ≈ kirish × 1.25, keshdan o'qish ≈ kirish × 0.1.

export type AiFeature =
  | "import.classify"
  | "import.analyze"
  | "import.match"
  | "import.watermark"
  | "import.verify"
  | "translate"
  | "watermark"
  | "report"
  | "ask"
  | "student";

export const DEFAULT_MODEL_PARSE = "claude-sonnet-5-5";
export const DEFAULT_MODEL_FAST = "claude-haiku-5-5";

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function parseModel(): string {
  return env("AI_MODEL_PARSE") ?? DEFAULT_MODEL_PARSE;
}

export function fastModel(): string {
  return env("AI_MODEL_FAST") ?? DEFAULT_MODEL_FAST;
}

/**
 * Funksiya → model. Fayl tahlili, rasmlarni ko'rish va moslashtirish — Sonnet;
 * tasnif, xulosalar va o'quvchi tahlili — Haiku. Ruscha tarjima sifat muhim
 * bo'lgani uchun Sonnet'da. Har biri alohida env bilan almashtiriladi.
 */
export function modelFor(feature: AiFeature): string {
  switch (feature) {
    case "translate":
      return env("AI_MODEL_TRANSLATE") ?? parseModel();
    case "watermark":
    case "import.watermark":
    case "import.verify":
      return env("AI_MODEL_WATERMARK") ?? parseModel();
    case "report":
    case "ask":
      return env("AI_MODEL_REPORT") ?? fastModel();
    case "student":
      return env("AI_MODEL_STUDENT") ?? fastModel();
    case "import.classify":
      return fastModel();
    case "import.analyze":
    case "import.match":
      return parseModel();
  }
}

interface Price {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const PRICES: Record<string, Price> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

/** Noma'lum model — eng qimmat narx bilan hisoblanadi (budjet kam ko'rsatilmasin). */
const FALLBACK_PRICE: Price = { input: 4, output: 20, cacheRead: 0.4, cacheWrite: 5 };

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export function costUsd(model: string, usage: TokenUsage): number {
  const p = PRICES[model] ?? FALLBACK_PRICE;
  const total =
    usage.inputTokens * p.input +
    usage.outputTokens * p.output +
    (usage.cacheReadTokens ?? 0) * p.cacheRead +
    (usage.cacheWriteTokens ?? 0) * p.cacheWrite;
  return total / 1_000_000;
}

/** Rasmning taxminiy tokenlari (Anthropic: ≈ eni × bo'yi / 750, eng uzun tomoni 1568 px gacha). */
export function imageTokens(width: number, height: number): number {
  const scale = Math.min(1, 1568 / Math.max(width, height, 1));
  return Math.ceil((width * scale * (height * scale)) / 750);
}
