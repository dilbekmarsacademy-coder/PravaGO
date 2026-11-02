// .txt: oddiy matn — har bir qator alohida (formatlash yo'q; javob belgilari: ✓, *, +, "To'g'ri javob:" qatorlari, jadval).

import { plainLine, type ReadResult } from "./types";

export function readTxt(text: string): ReadResult {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\t/g, " "))
    .filter((l) => l.trim())
    .map((l) => plainLine(l));
  return { lines, readImage: async () => null };
}
