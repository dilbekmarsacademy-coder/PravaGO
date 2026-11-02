// .pdf: unpdf (pdf.js) bilan — sahifa matni qatorlarga, rasmlar sahifa bo'yicha.
// PDF'da formatlash (qalin/rang) ishonchli o'qilmaydi — javob belgilari ✓/*/+ belgilari,
// "To'g'ri javob:" qatorlari va javoblar jadvalidan olinadi.
// Rasm sahifadagi tartib bo'yicha shu sahifadagi savollarga bog'lanadi (sahifa matnining
// oxiriga emas, birinchi rasmsiz savolga).

import sharp from "sharp";
import { plainLine, type Line, type ReadResult } from "./types";

interface PdfImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  channels: 1 | 3 | 4;
}

interface UnpdfModule {
  getDocumentProxy(data: Uint8Array): Promise<unknown>;
  extractText(pdf: unknown, options: { mergePages: false }): Promise<{ totalPages: number; text: string[] }>;
  extractImages(pdf: unknown, pageNumber: number): Promise<PdfImage[]>;
}

/**
 * unpdf — faqat ESM paket; Node 22+ uni `require` bilan yuklaydi (require(esm)).
 * Statik require — Vercel uni paketga qo'shishi uchun; test runner'da createRequire.
 */
function loadUnpdf(): UnpdfModule {
  if (process.env.VITEST) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("module") as typeof import("module")).createRequire(`${process.cwd()}/package.json`)("unpdf") as UnpdfModule;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("unpdf") as UnpdfModule;
}

export async function readPdf(buffer: Buffer): Promise<ReadResult> {
  const { getDocumentProxy, extractText, extractImages } = loadUnpdf();
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages: string[] = Array.isArray(text) ? text : [text];
  const lines: Line[] = [];
  const images = new Map<string, { data: Buffer; ext: string }>();
  for (let p = 0; p < pages.length; p++) {
    const pageLines = pages[p]
      .split(/\n/)
      .map((l: string) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .map((l: string) => plainLine(l));
    let pageImages: PdfImage[] = [];
    try {
      pageImages = await extractImages(pdf, p + 1);
    } catch {
      pageImages = [];
    }
    const refs: string[] = [];
    for (const [i, img] of pageImages.entries()) {
      if (img.width < 40 || img.height < 40) continue; // mayda bezaklar
      const png = await sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: img.channels } }).png().toBuffer();
      const ref = `pdf-p${p + 1}-${i + 1}`;
      images.set(ref, { data: png, ext: "png" });
      refs.push(ref);
    }
    // Rasmlarni sahifadagi savol sarlavhalari orasiga taqsimlaymiz (savol qatoridan keyin).
    const qIdx = pageLines.map((l: Line, i: number) => (/^\s*\d{1,3}\s*[-–.)]?\s*(савол|savol)?/iu.test(l.text) && /\D{8,}/.test(l.text) ? i : -1)).filter((i: number) => i >= 0);
    refs.forEach((ref, i) => {
      const target = qIdx[i] ?? pageLines.length - 1;
      if (target >= 0) pageLines[target].images.push({ pos: pageLines[target].text.length, ref });
    });
    lines.push(...pageLines);
  }
  return {
    lines,
    async readImage(ref) {
      const img = images.get(ref);
      return img ? { ref, ...img } : null;
    },
  };
}
