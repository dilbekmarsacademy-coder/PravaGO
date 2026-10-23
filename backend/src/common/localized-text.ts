// Kontent frontendga `{ uz, cyrl, ru }` ko'rinishida chiqariladi. Bazada
// o'zbekcha matn bitta yozuvda (ko'pincha kirill, ba'zan lotin) saqlanadi —
// qaysi yozuvdaligini shu yerda aniqlaymiz; yetishmagan variantni frontend
// transliteratsiya orqali to'ldiradi.

export interface LocalizedTextDto {
  uz?: string;
  cyrl?: string;
  ru?: string;
}

const CYRILLIC = /[Ѐ-ӿ]/;

/**
 * `latin` — alohida saqlangan o'zbek lotin matni (bo'lsa). Import qilingan
 * matnlar chetlarida bo'shliqsiz saqlanadi, shuning uchun `trim()` kalit so'z
 * belgilash pozitsiyalarini siljitmaydi.
 */
export function toLocalizedText(uzbek: string, russian?: string | null, latin?: string | null): LocalizedTextDto {
  const result: LocalizedTextDto = {};
  const text = uzbek.trim();
  if (text) {
    if (CYRILLIC.test(text)) result.cyrl = text;
    else result.uz = text;
  }
  if (latin?.trim()) result.uz = latin.trim();
  if (russian?.trim()) result.ru = russian.trim();
  return result;
}
