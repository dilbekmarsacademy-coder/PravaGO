// Fayl o'quvchilarning umumiy natijasi: hujjat tartibidagi qatorlar (har bir
// belgining formatlash bayroqlari bilan) va ichidagi rasmlar. Tuzilma (savollar,
// variantlar, javoblar, kalitlar) structure.ts da shu qatorlardan ajratiladi.

/** Belgi formatlash bayroqlari (bitmask). */
export const F_BOLD = 1;
export const F_COLOR = 2;
export const F_HIGHLIGHT = 4;

export interface Line {
  text: string;
  /** Har bir belgi uchun F_* bayroqlari (text bilan bir xil uzunlik). */
  flags: number[];
  /** Qatordagi rasmlar: `pos` — matndagi o'rni, `ref` — fayl ichidagi havola. */
  images: { pos: number; ref: string }[];
  /** Sarlavha uslubi (h1–h3, Heading) — mavzu sarlavhasi bo'lishi ehtimoli yuqori. */
  heading?: boolean;
}

export interface RawImage {
  ref: string;
  data: Buffer;
  ext: string;
}

/** Kalit so'z kartasi (HTML "article.card" formati): savol, to'g'ri javob va kalitlar. */
export interface KeyCard {
  number: number | null;
  question: string;
  answer: string;
  questionKey: string;
  answerKey: string;
}

export interface ReadResult {
  lines: Line[];
  readImage(ref: string): Promise<RawImage | null>;
  /** Faqat kalit so'z HTML fayllarida. */
  cards?: KeyCard[];
  /** Fayl sarlavhasi (HTML <h1>, PDF metadata va h.k.). */
  title?: string;
}

export function plainLine(text: string, flag = 0): Line {
  return { text, flags: Array.from({ length: text.length }, () => flag), images: [] };
}
