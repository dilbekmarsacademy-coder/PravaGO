// Kalit so'z belgilash: backend har bir til matni uchun `[start, end)` oralig'ini
// beradi. Ko'rsatiladigan matn `localize()` bilan bir xil tanlanadi; matn
// transliteratsiya orqali hosil qilingan bo'lsa (o'sha tilda asl matn yo'q),
// pozitsiyalar mos kelmaydi — belgilash ko'rsatilmaydi, matn o'zgarmaydi.

import type { Locale } from "@/lib/i18n/dictionary";
import { localize, type LocalizedText } from "@/lib/i18n/localized";
import type { HighlightRanges } from "@/lib/api/test";

export type Range = [number, number];

/** `localize()` qaysi asl matnni ishlatsa, o'sha matnning belgilash oralig'i. */
function rangeFor(text: LocalizedText, ranges: HighlightRanges | undefined, locale: Locale): Range | undefined {
  if (!ranges) return undefined;
  switch (locale) {
    case "uz-cyrl":
      return text.cyrl !== undefined ? ranges.cyrl : undefined;
    case "ru":
      if (text.ru !== undefined) return ranges.ru;
      return text.uz !== undefined ? ranges.uz : undefined;
    default:
      // formatUzLatin o'/g' ni bir belgili oʻ/gʻ ga almashtiradi — uzunlik o'zgarmaydi.
      return text.uz !== undefined ? ranges.uz : undefined;
  }
}

export interface HighlightedParts {
  before: string;
  mark: string;
  after: string;
}

/** Matnni belgilangan bo'lak atrofida bo'ladi; oraliq yo'q yoki noto'g'ri bo'lsa — `null`. */
export function splitHighlight(text: string, range: Range | undefined): HighlightedParts | null {
  if (!range) return null;
  const [start, end] = range;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > text.length || start >= end) return null;
  return { before: text.slice(0, start), mark: text.slice(start, end), after: text.slice(end) };
}

export function localizeHighlighted(
  text: LocalizedText,
  ranges: HighlightRanges | undefined,
  locale: Locale,
): { text: string; parts: HighlightedParts | null } {
  const value = localize(text, locale);
  return { text: value, parts: splitHighlight(value, rangeFor(text, ranges, locale)) };
}
