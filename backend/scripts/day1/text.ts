// Matn yordamchilari: kirill → lotin transliteratsiyasi (har bir chiqish
// belgisi qaysi manba belgisidan kelganini eslab qoladi), taqqoslash uchun
// normallashtirish va o'xshashlik.
//
// Transliteratsiya qoidalari frontend'dagi `cyrillicToLatin` bilan AYNAN bir
// xil (src/lib/i18n/translit.ts) — import skripti natijani u bilan solishtirib
// tekshiradi, shuning uchun saytda ko'rinadigan matn bilan pozitsiyalar mos keladi.

const OKINA = "ʻ";

const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ё: "yo", ж: "j", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s",
  т: "t", у: "u", ф: "f", х: "x", ч: "ch", ш: "sh", щ: "sh", ы: "i", э: "e",
  ю: "yu", я: "ya", ў: `o${OKINA}`, қ: "q", ғ: `g${OKINA}`, ҳ: "h", ь: "",
  ъ: "ʼ",
};

const CYR_VOWELS = new Set([..."аеёиоуэюяўы"]);

function isLetter(ch: string | undefined): boolean {
  return !!ch && /\p{L}/u.test(ch);
}

function isUpper(ch: string | undefined): boolean {
  return !!ch && ch !== ch.toLowerCase();
}

/** Matn va har bir belgining manbadagi indeksi. */
export interface MappedText {
  text: string;
  /** `map[i]` — `text[i]` manba matnning qaysi belgisidan kelgan. */
  map: number[];
}

/** O'zbek kirill → lotin (frontend `cyrillicToLatin` bilan bir xil) + pozitsiya xaritasi. */
export function cyrillicToLatinMapped(source: string): MappedText {
  let text = "";
  const map: number[] = [];
  const push = (out: string, from: number) => {
    text += out;
    for (let k = 0; k < out.length; k++) map.push(from);
  };

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const lower = ch.toLowerCase();
    const prev = source[i - 1]?.toLowerCase();

    let mapped: string | undefined;
    if (lower === "е") {
      const afterVowel = prev !== undefined && (CYR_VOWELS.has(prev) || prev === "ъ" || prev === "ь");
      mapped = !isLetter(source[i - 1]) || afterVowel ? "ye" : "e";
    } else if (lower === "ц") {
      mapped = !isLetter(source[i - 1]) ? "s" : "ts";
    } else {
      mapped = CYR_TO_LAT[lower];
    }

    if (mapped === undefined) {
      push(ch, i);
      continue;
    }
    if (!isUpper(ch) || mapped.length === 0) {
      push(mapped, i);
      continue;
    }
    const wordIsUpper = isUpper(source[i + 1]) || (isLetter(source[i - 1]) && isUpper(source[i - 1]));
    push(wordIsUpper ? mapped.toUpperCase() : mapped[0].toUpperCase() + mapped.slice(1), i);
  }
  return { text, map };
}

const APOSTROPHES = /['‘’ʻʼ`´]/;

/**
 * Taqqoslash uchun: kichik harf, apostroflar (o‘/oʻ/o') olib tashlanadi,
 * tinish belgilari — bo'shliq, bo'shliqlar siqiladi. `map` — normallashgan
 * matndagi har bir belgining asl matndagi indeksi.
 */
export function normalizeMapped(source: string): MappedText {
  let text = "";
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (APOSTROPHES.test(ch)) continue;
    if (/[\p{L}\p{N}]/u.test(ch)) {
      if (pendingSpace && text.length > 0) {
        text += " ";
        map.push(i);
      }
      pendingSpace = false;
      const lower = ch.toLowerCase();
      // "ё" va "e" kabi farqlar taqqoslashga ta'sir qilmasin (rus matnlarida).
      const folded = lower === "ё" ? "е" : lower;
      text += folded;
      map.push(i);
    } else {
      pendingSpace = true;
    }
  }
  return { text, map };
}

export function normalize(source: string): string {
  return normalizeMapped(source).text;
}

/** Lotin yoki kirill matnni taqqoslash uchun lotin ko'rinishga keltiradi. */
export function comparable(source: string): string {
  return normalize(/[Ѐ-ӿ]/.test(source) ? cyrillicToLatinMapped(source).text : source);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0..1 — normallashgan matnlar orasidagi Levenshtein o'xshashligi. */
export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

export type Range = [number, number];

/**
 * `needle` ni `haystack` ichidan normallashgan ko'rinishda (so'z chegarasida)
 * qidiradi va asl `haystack` dagi `[start, end)` oralig'ini qaytaradi.
 */
export function findRange(haystack: string, needle: string): Range | null {
  const h = normalizeMapped(haystack);
  const n = normalize(needle);
  if (!n) return null;
  let from = 0;
  while (from <= h.text.length) {
    const idx = h.text.indexOf(n, from);
    if (idx < 0) return null;
    const before = h.text[idx - 1];
    const after = h.text[idx + n.length];
    if ((before === undefined || before === " ") && (after === undefined || after === " ")) {
      return [h.map[idx], h.map[idx + n.length - 1] + 1];
    }
    from = idx + 1;
  }
  return null;
}

/** So'zlar mos keladimi: bir xil, qo'shimcha bilan farq qiladi (avtomobil/avtomobilning) yoki imloda yaqin (engil/yengil). */
function wordsMatch(text: string, key: string): boolean {
  if (text === key) return true;
  const minStem = Math.min(text.length, key.length);
  if (minStem >= 4 && (text.startsWith(key) || key.startsWith(text))) return true;
  return similarity(text, key) >= 0.8;
}

export interface FoundRange {
  range: Range;
  /** Aniq emas, so'z darajasida taxminiy moslik (qo'shimcha yoki imlo farqi). */
  approximate: boolean;
}

/**
 * Avval aniq qidiradi (`findRange`), topilmasa — so'zma-so'z taxminiy qidiruv:
 * kalit so'zning har bir so'zi matndagi ketma-ket so'zga mos kelishi kerak
 * (o'zbekcha qo'shimchalar va kichik imlo farqlari hisobga olinadi).
 * Belgilash matndagi to'liq so'zlarni qamraydi.
 */
export function findWordsRange(haystack: string, needle: string): FoundRange | null {
  const exact = findRange(haystack, needle);
  if (exact) return { range: exact, approximate: false };
  const h = normalizeMapped(haystack);
  const keyWords = normalize(needle).split(" ").filter(Boolean);
  if (!keyWords.length) return null;
  const words: { text: string; start: number; end: number }[] = [];
  for (const m of h.text.matchAll(/\S+/g)) {
    const start = m.index ?? 0;
    words.push({ text: m[0], start, end: start + m[0].length });
  }
  for (let i = 0; i + keyWords.length <= words.length; i++) {
    if (keyWords.every((key, k) => wordsMatch(words[i + k].text, key))) {
      const first = words[i];
      const last = words[i + keyWords.length - 1];
      return { range: [h.map[first.start], h.map[last.end - 1] + 1], approximate: true };
    }
  }
  return null;
}

/**
 * Lotin kalit so'zni kirill matndan qidiradi: matn transliteratsiya qilinadi,
 * topilgan oraliq kirill matn pozitsiyalariga qaytariladi.
 */
export function findLatinInCyrillic(cyrillic: string, latinNeedle: string): FoundRange | null {
  const latin = cyrillicToLatinMapped(cyrillic);
  const found = findWordsRange(latin.text, latinNeedle);
  if (!found) return null;
  let end = latin.map[found.range[1] - 1] + 1;
  // "ь"/"ъ" lotinda bo'sh (yoki tutuq) — so'z oxiridagisi belgilashga kirsin: "автомобиль".
  while (end < cyrillic.length && /[ьЬъЪ]/.test(cyrillic[end])) end++;
  return { range: [latin.map[found.range[0]], end], approximate: found.approximate };
}

/** Bo'shliqlarni siqadi va chetlarini kesadi. */
export function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
