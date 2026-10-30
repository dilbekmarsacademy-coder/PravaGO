// Markaz o'quvchisi uchun login va parol yaratish/tekshirish.
// Parol alifbosida o'xshash belgilar (0/O/o, 1/l/I/i) yo'q — o'qish va yozish oson.

import { randomInt } from "crypto";

const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const GENERATED_PASSWORD_LENGTH = 8;
export const MIN_CENTER_PASSWORD_LENGTH = 6;
/** Kiritish formati (katta harf ham mumkin — saqlashda kichik harfga o'tkaziladi). */
export const LOGIN_PATTERN = /^[A-Za-z0-9._-]{3,40}$/;

export function generatePassword(length = GENERATED_PASSWORD_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

/** "pt" + 5 ta tasodifiy raqam (unique'likni chaqiruvchi tekshiradi). */
export function generateLogin(): string {
  return `pt${String(randomInt(100_000)).padStart(5, "0")}`;
}

export function normalizeLogin(raw: string): string {
  return raw.trim().toLowerCase();
}
