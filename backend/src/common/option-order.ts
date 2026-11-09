// Variantlarni aralashtirish — random testlar va yakuniy imtihon uchun umumiy.
// Frontend'dagi nusxasi: src/lib/test/shuffle.ts (kunlik testda "tashlab ketilgan
// savolga qaytganda variantlar joyi almashadi"). Qoidalar ikkala joyda bir xil.

export type Random = () => number;

/** Fisher–Yates. */
export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Qayta aralashtirish: har bir element avvalgi joyida qolmaydi (2 tadan kam
 * bo'lsa — o'zgarishsiz). Javob berilmay tashlab ketilgan savolga qaytilganda.
 */
export function reshuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  if (items.length < 2) return [...items];
  for (let attempt = 0; attempt < 20; attempt++) {
    const next = shuffle(items, random);
    if (next.every((item, i) => item !== items[i])) return next;
  }
  // Juda kam ehtimolli holat — bir qadam aylantiramiz (har biri boshqa joyda).
  return [...items.slice(1), items[0]];
}

// ── Tartibga bog'liq variantlar ──
// Variant boshqa variantlarga ("Hammasi to'g'ri", "Yuqoridagilarning barchasi",
// "Hech biri") yoki harf/raqam belgisiga ("A va B", "1 va 2", "Faqat «Б»",
// "F2", "1) ...") tayansa — savol variantlari aralashtirilmaydi.

const APOS = "['ʻʼ’`‘]?";
const PHRASES: RegExp[] = [
  // O'zbek (lotin)
  new RegExp(`^(hammasi|barchasi|barchasida|hammasida)(\\s+(ham\\s+)?(to${APOS}g${APOS}ri|noto${APOS}g${APOS}ri))?$`),
  new RegExp(`\\b(barcha|hamma)\\s+(javob|variant|sanab|ko${APOS}rsatilgan|keltirilgan|holatlar\\s+to${APOS}g${APOS}ri)`),
  new RegExp(`\\bsanab\\s+o${APOS}tilgan\\b`),
  new RegExp(`\\byuqoridagi`),
  new RegExp(`^hech\\s+(biri|qaysi(si)?)(\\s+(biri|javob\\S*|variant\\S*|to${APOS}g${APOS}ri\\S*))?$`),
  new RegExp(`\\b(har\\s+)?ikkala(si)?\\s+(javob|variant)`),
  new RegExp(`\\bhar\\s+ikki(si|la)?\\s+(to${APOS}g${APOS}ri|noto${APOS}g${APOS}ri|sanab)`),
  new RegExp(`\\bto${APOS}g${APOS}ri\\s+javob\\s+yo${APOS}q`),
  new RegExp(`\\b(birinchi|ikkinchi|uchinchi|to${APOS}rtinchi|[1-9]-)\\s*(va\\s+\\S+\\s+)?javob`),
  // O'zbek (kirill)
  /^(ҳаммаси|барчаси|барчасида|ҳаммасида)(\s+(ҳам\s+)?(тўғри|нотўғри))?$/,
  /(^|\s)(барча|ҳамма)\s+(жавоб|вариант|санаб|кўрсатилган|келтирилган|ҳолатлар\s+тўғри)/,
  /(^|\s)санаб\s+ўтилган/,
  /(^|\s)юқоридаги/,
  /^ҳеч\s+(бири|қайси(си)?)(\s+(бири|жавоб\S*|вариант\S*|тўғри\S*))?$/,
  /(^|\s)ҳар\s+икки(си|ла)?\s+(тўғри|нотўғри|санаб)/,
  /(^|\s)тўғри\s+жавоб\s+йўқ/,
  // Rus
  /^(все|всё|во всех|на всех)(\s+(верно|верны|правильно|правильны|неверны|неправильны))?$/,
  /(^|\s)вс[её]\s+(ответы|варианты|перечисленн|указанн|приведённ|приведенн|вышеперечисл)/,
  /(^|\s)(во\s+)?всех\s+(перечисленн|указанн|вышеперечисл|вышеуказанн)/,
  /вышеперечисл|вышеуказанн|приведённые выше|приведенные выше/,
  /^ни\s+од(ин|на|но)(\s+из\s+(ответов|вариантов|перечисленн\S*))?(\s+не\s+верн\S*)?$/,
  /(^|\s)нет\s+правильного/,
  /(^|\s)оба\s+(правильн|неправильн|ответ|вариант)|(^|\s)в\s+обоих\s+перечисленн/,
  /(^|\s)(перв|втор|трет|четв)\S*\s+(и\s+\S+\s+)?ответ/,
];

/** Variant belgisiga ishora: "F2", "1) ...", "A) ...". */
const LABEL_REF = /(^|[\s(«"])F[1-9]\b|^\s*[1-9A-DА-ГВС][).]\s/;
const CONNECTORS = new Set(["faqat", "фақат", "только", "va", "ва", "и", "and", "yoki", "ёки", "или", "hamda", "ҳамда", "to'g'ri", "toʻgʻri", "тўғри", "верно", "правильно"]);

/**
 * Faqat harf/raqam belgilaridan iborat variant: "1 va 2", "Faqat «Б» va «В»", "Faqat A".
 * Harf belgisi — bitta KATTA harf ("25 m", "3,5 t" kabi o'lchov birliklari emas).
 */
function isLabelOnly(text: string): boolean {
  const tokens = text
    .replace(/[«»"“”„()[\].;:!?]/g, " ")
    .split(/\s+|,\s+|,(?=\D)/)
    .map((t) => t.trim())
    .filter(Boolean);
  const rest = tokens.filter((t) => !CONNECTORS.has(t.toLowerCase()));
  if (rest.length === 0 || (rest.length === tokens.length && rest.length === 1 && /^\d+$/.test(rest[0]))) return false;
  return rest.every((t) => /^(\d{1,2}|[A-ZА-ЯЁ])$/.test(t));
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[.!?;:]+$/g, "").trim();
}

/** Bitta variant matni (istalgan tilda) tartibga bog'liqmi. */
export function isOrderDependentText(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = normalize(text);
  if (!t) return false;
  return LABEL_REF.test(text.trim()) || isLabelOnly(text.trim()) || PHRASES.some((re) => re.test(t));
}

/** Savol variantlari aralashtirilmaydi: biror variant (biror tilda) tartibga bog'liq. */
export function isOrderLocked(options: readonly { text: string; textLatn?: string | null; textRu?: string | null }[]): boolean {
  return options.some((o) => isOrderDependentText(o.text) || isOrderDependentText(o.textLatn) || isOrderDependentText(o.textRu));
}

/** Urinish uchun boshlang'ich tartib: qulflangan savolda — manbadagi tartib, aks holda aralash. */
export function initialOrder(ids: readonly string[], locked: boolean, random: Random = Math.random): string[] {
  return locked ? [...ids] : shuffle(ids, random);
}
