// Kalit so'z belgilash: backend har bir til matni uchun `[start, end)` oralig'ini
// (bir nechta bo'lakli kalit so'zda — oraliqlar ro'yxatini) beradi. Ko'rsatiladigan
// matn `localize()` bilan bir xil tanlanadi; matn transliteratsiya orqali hosil
// qilingan bo'lsa (o'sha tilda asl matn yo'q), pozitsiyalar mos kelmaydi —
// belgilash ko'rsatilmaydi, matn o'zgarmaydi.

import type { Locale } from "@/lib/i18n/dictionary";
import { localize, type LocalizedText } from "@/lib/i18n/localized";
import type { HighlightRanges, HighlightValue } from "@/lib/api/test";

export type Range = [number, number];

/** `localize()` qaysi asl matnni ishlatsa, o'sha matnning belgilash oralig'i. */
function rangeFor(text: LocalizedText, ranges: HighlightRanges | undefined, locale: Locale): HighlightValue | undefined {
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

function isRange(value: unknown): value is Range {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number";
}

export interface HighlightSegment {
  text: string;
  marked: boolean;
}

/**
 * Matnni belgilangan bo'laklar bo'yicha bo'ladi. Oraliq yo'q, noto'g'ri yoki
 * oraliqlar bir-birini kesib o'tsa — `null` (matn belgilashsiz ko'rsatiladi).
 */
export function splitHighlight(text: string, value: HighlightValue | undefined): HighlightSegment[] | null {
  if (!value) return null;
  const ranges: Range[] = isRange(value) ? [value] : value;
  if (!ranges.length) return null;
  const segments: HighlightSegment[] = [];
  let pos = 0;
  for (const [start, end] of ranges) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < pos || end > text.length || start >= end) return null;
    if (start > pos) segments.push({ text: text.slice(pos, start), marked: false });
    segments.push({ text: text.slice(start, end), marked: true });
    pos = end;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos), marked: false });
  return segments;
}

export function localizeHighlighted(
  text: LocalizedText,
  ranges: HighlightRanges | undefined,
  locale: Locale,
): { text: string; segments: HighlightSegment[] | null } {
  const value = localize(text, locale);
  return { text: value, segments: splitHighlight(value, rangeFor(text, ranges, locale)) };
}
