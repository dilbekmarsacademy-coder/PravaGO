// Kalit so'zni avtomatik topish (admin "sayt o'zi joylashtirsin" deganda).
//
// Javob kaliti — to'g'ri variantning BOSHQA variantlarda uchramaydigan so'zlari
// (eng uzun ketma-ket bo'lakdagi eng "og'ir" 1–2 so'z): aynan shu so'zlar to'g'ri
// javobni ajratib turadi. Savol kaliti — savoldagi eng uzun mazmunli so'z
// (yonidagi mazmunli so'z bilan, ko'pi bilan 2 so'z). Natija — oddiy taklif:
// admin "Kalit so'zlar" bo'limida ko'rib, kerak bo'lsa tuzatadi.

import { latinToCyrillic } from "@/lib/i18n/translit";
import { rangesValid, suggestRanges, type LangRanges, type Range, type Texts } from "./keywords";

interface Token {
  start: number;
  end: number;
  norm: string;
}

const WORD = /[\p{L}\p{N}](?:[\p{L}\p{N}'‘’ʻʼ`-]*[\p{L}\p{N}])?/gu;

function norm(s: string): string {
  return s.toLowerCase().replace(/[‘’ʻʼ`]/g, "'");
}

function tokenize(text: string): Token[] {
  return [...text.matchAll(WORD)].map((m) => ({ start: m.index, end: m.index + m[0].length, norm: norm(m[0]) }));
}

const UZ_STOP = [
  "va", "yoki", "bilan", "uchun", "ham", "esa", "lekin", "biroq", "agar", "u", "bu", "shu", "ushbu", "o'sha", "bunda", "bunday", "shunday",
  "qaysi", "qanday", "qancha", "necha", "nechta", "nima", "nimani", "nimaga", "kim", "kimga", "qayerda", "qachon", "qaerda", "nega",
  "bo'ladi", "bo'lsa", "bo'lgan", "bo'lishi", "bo'lib", "mumkin", "kerak", "lozim", "shart", "emas", "yo'q", "bor", "etiladi", "etiladimi",
  "holda", "hollarda", "holatda", "vaqtda", "paytda", "tomonidan", "orqali", "keyin", "oldin", "avval", "dan", "da", "ga", "ni", "ning",
  "har", "barcha", "hamma", "faqat", "hech", "eng", "juda", "boshqa", "o'z", "uning", "ularning", "siz", "sizga", "sizning", "men", "biz",
  // Savollarda tez-tez uchraydigan, mazmun bermaydigan so'zlar.
  "bildiradi", "anglatadi", "ko'rsatadi", "ko'rsatilgan", "ataladi", "deyiladi", "hisoblanadi", "foydalaniladi", "belgi", "belgisi", "belgilar",
  "rasm", "rasmda", "rasmdagi", "rasmlarda", "javob", "javobda", "to'g'ri", "noto'g'ri", "sanab", "o'tilgan", "ta'rifi", "atamasi",
];
const UZ_STOP_SET = new Set(UZ_STOP.map(norm));
const CYRL_STOP_SET = new Set(UZ_STOP.map((w) => norm(latinToCyrillic(w))));
const RU_STOP_SET = new Set(
  (
    "и в во на с со к ко по о об от до из за для при без над под у не ни но а или же ли бы то это этот эта эти тот та те как какой какая какие " +
    "каком какое что чем кто где когда сколько почему ли разрешается разрешено запрещается можно нужно должен должна должны является ли " +
    "в случае если при этом его ее её их он она они вы вам вас ваш все всех всем только также уже ещё еще очень самый более менее " +
    "означает обозначает указывает называется знак знака рисунке рисунок ответ ответе правильный перечисленных"
  ).split(/\s+/),
);

/** Belgilangan oraliq tilga qarab (o'zbek lotin / kirill / rus) stop-so'zlar. */
function stopsFor(lang: "uz" | "cyrl" | "ru"): Set<string> {
  return lang === "uz" ? UZ_STOP_SET : lang === "cyrl" ? CYRL_STOP_SET : RU_STOP_SET;
}

const isContent = (t: Token, stops: Set<string>) => !stops.has(t.norm) && !/^\d+$/.test(t.norm) && t.norm.length >= 2;

/** To'g'ri javobning ajratib turuvchi bo'lagi (bo'lmasa — mazmunli so'zlar, bo'lmasa — butun variant). */
export function answerRange(correct: string, others: string[], stops: Set<string>): Range | null {
  const tokens = tokenize(correct);
  if (tokens.length === 0) return null;
  // Qisqa variant ("Tramvay", "А va Б", "Tik balandlik") — butunligicha.
  if (tokens.length <= 3) return [tokens[0].start, tokens[tokens.length - 1].end];
  const otherWords = new Set(others.flatMap((o) => tokenize(o).map((t) => t.norm)));
  let pick = (t: Token) => !otherWords.has(t.norm) && isContent(t, stops);
  if (!tokens.some(pick)) pick = (t: Token) => isContent(t, stops);
  if (!tokens.some(pick)) pick = () => true;

  // Eng uzun ketma-ket bo'lak (oraliqdagi stop-so'zlar bo'lakni uzmaydi, lekin chetga chiqmaydi).
  let best: [number, number] | null = null;
  let i = 0;
  while (i < tokens.length) {
    if (!pick(tokens[i])) {
      i++;
      continue;
    }
    let j = i;
    let lastPicked = i;
    while (j + 1 < tokens.length && (pick(tokens[j + 1]) || (stops.has(tokens[j + 1].norm) && j + 2 < tokens.length && pick(tokens[j + 2])))) {
      j++;
      if (pick(tokens[j])) lastPicked = j;
    }
    const len = lastPicked - i + 1;
    if (!best || len > best[1] - best[0] + 1) best = [i, lastPicked];
    i = j + 1;
  }
  if (!best) return null;
  // Bo'lak ichida — harflari eng ko'p 1–2 ta yonma-yon tanlangan so'z.
  let from = best[0];
  let to = best[0];
  let weight = -1;
  for (let k = best[0]; k <= best[1]; k++) {
    if (!pick(tokens[k])) continue;
    const next = k + 1 <= best[1] && pick(tokens[k + 1]) ? k + 1 : k;
    const w = tokens.slice(k, next + 1).reduce((n, t) => n + t.norm.length, 0);
    if (w > weight) [from, to, weight] = [k, next, w];
  }
  return [tokens[from].start, tokens[to].end];
}

/** Savoldagi eng uzun mazmunli so'z (+ yonidagi mazmunli so'z). */
export function questionRange(question: string, stops: Set<string>): Range | null {
  const tokens = tokenize(question);
  const candidates = tokens.map((t, i) => ({ t, i })).filter(({ t }) => isContent(t, stops) && t.norm.length >= 4);
  if (candidates.length === 0) return null;
  const { i } = candidates.reduce((a, b) => (b.t.norm.length > a.t.norm.length ? b : a));
  const next = tokens[i + 1];
  const end = next && isContent(next, stops) && next.norm.length >= 3 ? next.end : tokens[i].end;
  return [tokens[i].start, end];
}

function one(text: string, range: Range | null): Range[] | undefined {
  return range && rangesValid(text, [range]) ? [range] : undefined;
}

/**
 * Savol va to'g'ri javob uchun kalit so'z oraliqlari (kirill, lotin, rus).
 * Kirill — asosiy; lotin oralig'i kirilldan transliteratsiya orqali topiladi
 * (ikkala yozuvda bir xil so'z belgilanishi uchun), topilmasa — mustaqil.
 */
export function autoKeywords(text: Texts, options: Texts[], correctIndex: number): { question: LangRanges; answer: LangRanges } | null {
  const correct = options[correctIndex];
  if (!correct) return null;
  const others = options.filter((_, i) => i !== correctIndex);
  const question: LangRanges = {};
  const answer: LangRanges = {};

  const qCyrl = one(text.cyrl, questionRange(text.cyrl, stopsFor("cyrl")));
  const aCyrl = one(correct.cyrl, answerRange(correct.cyrl, others.map((o) => o.cyrl), stopsFor("cyrl")));
  if (qCyrl) question.cyrl = qCyrl;
  if (aCyrl) answer.cyrl = aCyrl;

  const qUz = (qCyrl && suggestRanges(text.cyrl, qCyrl, "cyrl", text.latn)) || one(text.latn, questionRange(text.latn, stopsFor("uz")));
  const aUz =
    (aCyrl && suggestRanges(correct.cyrl, aCyrl, "cyrl", correct.latn)) || one(correct.latn, answerRange(correct.latn, others.map((o) => o.latn), stopsFor("uz")));
  if (qUz) question.uz = qUz;
  if (aUz) answer.uz = aUz;

  if (text.ru && correct.ru) {
    const qRu = one(text.ru, questionRange(text.ru, stopsFor("ru")));
    const aRu = one(correct.ru, answerRange(correct.ru, others.map((o) => o.ru), stopsFor("ru")));
    if (qRu) question.ru = qRu;
    if (aRu) answer.ru = aRu;
  }

  if (!Object.keys(question).length && !Object.keys(answer).length) return null;
  return { question, answer };
}
