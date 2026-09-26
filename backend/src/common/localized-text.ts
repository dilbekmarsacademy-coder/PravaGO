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

export function toLocalizedText(uzbek: string, russian?: string | null): LocalizedTextDto {
  const result: LocalizedTextDto = {};
  const text = uzbek.trim();
  if (text) {
    if (CYRILLIC.test(text)) result.cyrl = text;
    else result.uz = text;
  }
  if (russian?.trim()) result.ru = russian.trim();
  return result;
}
