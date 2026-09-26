"use client";

import { useSyncExternalStore } from "react";
import { dictionaries, DEFAULT_LOCALE, type Dictionary, type Locale } from "./index";
import { savePreferredLanguage } from "@/lib/registration-store";

/** Tanlangan til cookie'si — layout'dagi bloklovchi skript ham shuni o'qiydi. */
export const LOCALE_COOKIE = "lang";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const VALID_LOCALES: Locale[] = ["uz-latn", "uz-cyrl", "ru"];
const HTML_LANG: Record<Locale, string> = {
  "uz-latn": "uz",
  "uz-cyrl": "uz-Cyrl",
  ru: "ru",
};

const listeners = new Set<() => void>();

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (VALID_LOCALES as string[]).includes(value);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Locale {
  const attr = document.documentElement.getAttribute("data-locale");
  return isLocale(attr) ? attr : DEFAULT_LOCALE;
}

// Bloklovchi <head> skripti ham sukut bo'yicha shu tilni tanlaydi — mos keladi.
function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

/** Tilni qo'llaydi: DOM, cookie, localStorage va (mavjud bo'lsa) foydalanuvchi profili. */
export function setLocale(locale: Locale) {
  applyLocale(locale);
  savePreferredLanguage(locale);
}

/** Profilga yozmasdan tilni qo'llaydi — profildagi tilni tiklashda ishlatiladi. */
export function applyLocale(locale: Locale) {
  document.documentElement.setAttribute("data-locale", locale);
  document.documentElement.lang = HTML_LANG[locale];
  document.title = dictionaries[locale].meta.title;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  try {
    localStorage.setItem("lang", locale);
  } catch {
    // localStorage mavjud bo'lmasa (masalan, shaxsiy oynada) e'tiborsiz qoldiramiz.
  }
  listeners.forEach((listener) => listener());
}

export function useLocale(): { locale: Locale; setLocale: typeof setLocale; t: Dictionary } {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { locale, setLocale, t: dictionaries[locale] };
}
