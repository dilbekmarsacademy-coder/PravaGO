import type { Dictionary, Locale } from "./dictionary";
import { uzLatn } from "./locales/uz-latn";
import { uzCyrl } from "./locales/uz-cyrl";
import { ru } from "./locales/ru";

export const dictionaries: Record<Locale, Dictionary> = {
  "uz-latn": uzLatn,
  "uz-cyrl": uzCyrl,
  ru,
};

export type { Dictionary, Locale };
export { LOCALE_META, DEFAULT_LOCALE } from "./dictionary";
