// O'zbek lotin → kirill transliteratsiyasi va lotin matnini to'g'ri
// belgilar bilan ko'rsatish. Faqat kontent uchun FALLBACK sifatida
// ishlatiladi — UI matnlari lug'atlarda (locales/*.ts) qo'lda yozilgan.

/** Apostrofning foydalanuvchilar yozadigan barcha variantlari. */
const APOSTROPHES = new Set(["'", "‘", "’", "ʻ", "ʼ"]);

/** Oʻ/gʻ uchun to'g'ri belgi (U+02BB MODIFIER LETTER TURNED COMMA). */
const OKINA = "ʻ";

const SINGLE: Record<string, string> = {
  a: "а", b: "б", d: "д", e: "е", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж",
  k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "қ", r: "р", s: "с",
  t: "т", u: "у", v: "в", x: "х", y: "й", z: "з", c: "с", w: "в",
};

const Y_DIGRAPHS: Record<string, string> = { o: "ё", u: "ю", a: "я", e: "е" };

// `ts` → `ц` faqat ruscha o'zlashmalarda (o'zbekcha "ketsa", "o'tsa" kabi
// so'zlarda `тс` qoladi). `-tsiya` qo'shimchasi va so'z boshidagi `ts`
// avtomatik aniqlanadi, qolganlari shu ro'yxat orqali.
const TS_LOANWORD_STEMS = ["sotsial", "patsient", "dotsent", "kontsert", "abzats", "shprits"];

function isLetter(ch: string | undefined): boolean {
  return !!ch && /\p{L}/u.test(ch);
}

function isApostrophe(ch: string | undefined): boolean {
  return !!ch && APOSTROPHES.has(ch);
}

function matchCase(source: string, target: string): string {
  return source !== source.toLowerCase() ? target.toUpperCase() : target;
}

/** `i` pozitsiyasi joylashgan so'zni (faqat harf va apostroflar) qaytaradi. */
function wordAround(text: string, i: number): { word: string; start: number } {
  const isWordChar = (ch: string | undefined) => isLetter(ch) || isApostrophe(ch);
  let start = i;
  while (start > 0 && isWordChar(text[start - 1])) start--;
  let end = i;
  while (end < text.length && isWordChar(text[end])) end++;
  return { word: text.slice(start, end).toLowerCase(), start };
}

function isTsLoanword(text: string, i: number): boolean {
  const { word, start } = wordAround(text, i);
  const offset = i - start;
  if (offset === 0) return true; // so'z boshidagi ts: tsement, tsex, tsirk
  if (word.startsWith("tsiya", offset)) return true; // stantsiya, operatsiya
  return TS_LOANWORD_STEMS.some((stem) => word.includes(stem));
}

/** O'zbek lotin matnini o'zbek kirill yozuviga o'giradi. */
export function latinToCyrillic(text: string): string {
  let out = "";
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    const lower = ch.toLowerCase();
    const next = text[i + 1];
    const nextLower = next?.toLowerCase();

    // oʻ / gʻ — apostrof bilan birga bitta harf.
    if ((lower === "o" || lower === "g") && isApostrophe(next)) {
      out += matchCase(ch, lower === "o" ? "ў" : "ғ");
      i += 2;
      continue;
    }

    // Tutuq belgisi (ikki harf orasidagi apostrof) → ъ.
    if (isApostrophe(ch)) {
      out += isLetter(text[i - 1]) && isLetter(next) ? "ъ" : ch;
      i += 1;
      continue;
    }

    // yo/yu/ya/ye — lekin "yo'l" kabi so'zlarda y + oʻ bo'ladi.
    if (lower === "y" && nextLower && Y_DIGRAPHS[nextLower] && !isApostrophe(text[i + 2])) {
      out += matchCase(ch, Y_DIGRAPHS[nextLower]);
      i += 2;
      continue;
    }

    if (lower === "s" && nextLower === "h") {
      out += matchCase(ch, "ш");
      i += 2;
      continue;
    }

    if (lower === "c" && nextLower === "h") {
      out += matchCase(ch, "ч");
      i += 2;
      continue;
    }

    if (lower === "t" && nextLower === "s" && isTsLoanword(text, i)) {
      out += matchCase(ch, "ц");
      i += 2;
      continue;
    }

    if (lower === "e" && !isLetter(text[i - 1])) {
      out += matchCase(ch, "э");
      i += 1;
      continue;
    }

    const mapped = SINGLE[lower];
    out += mapped ? matchCase(ch, mapped) : ch;
    i += 1;
  }

  return out;
}

const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ё: "yo", ж: "j", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s",
  т: "t", у: "u", ф: "f", х: "x", ч: "ch", ш: "sh", щ: "sh", ы: "i", э: "e",
  ю: "yu", я: "ya", ў: `o${OKINA}`, қ: "q", ғ: `g${OKINA}`, ҳ: "h", ь: "",
  ъ: "\u02BC",
};

const CYR_VOWELS = new Set([..."аеёиоуэюяўы"]);

function isUpper(ch: string | undefined): boolean {
  return !!ch && ch !== ch.toLowerCase();
}

/** O'zbek kirill matnini o'zbek lotin yozuviga o'giradi (oʻ/gʻ — U+02BB, tutuq — U+02BC). */
export function cyrillicToLatin(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const lower = ch.toLowerCase();
    const prev = text[i - 1]?.toLowerCase();

    let mapped: string | undefined;
    if (lower === "е") {
      // So'z boshida, unli yoki ъ/ь dan keyin — "ye", aks holda "e".
      const afterVowel = prev !== undefined && (CYR_VOWELS.has(prev) || prev === "ъ" || prev === "ь");
      mapped = !isLetter(text[i - 1]) || afterVowel ? "ye" : "e";
    } else if (lower === "ц") {
      mapped = !isLetter(text[i - 1]) ? "s" : "ts";
    } else {
      mapped = CYR_TO_LAT[lower];
    }

    if (mapped === undefined) {
      out += ch;
      continue;
    }
    if (!isUpper(ch) || mapped.length === 0) {
      out += mapped;
      continue;
    }
    // Katta harf: butun so'z katta bo'lsa — "SH", aks holda — "Sh".
    const wordIsUpper = isUpper(text[i + 1]) || (isLetter(text[i - 1]) && isUpper(text[i - 1]));
    out += wordIsUpper ? mapped.toUpperCase() : mapped[0].toUpperCase() + mapped.slice(1);
  }
  return out;
}

/** Lotin matnida `o'`/`g'` ni to'g'ri `oʻ`/`gʻ` (U+02BB) belgisi bilan almashtiradi. */
export function formatUzLatin(text: string): string {
  return text.replace(/([oOgG])['‘’ʻʼ]/g, `$1${OKINA}`);
}
