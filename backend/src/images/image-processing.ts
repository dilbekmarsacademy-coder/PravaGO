// Rasmga ishlov berish (tashqi pullik servissiz):
//  - watermark: ai-import/watermark/clean.ts — aniq niqob (ma'lum shablon yoki quti ichidagi piksellar)
//    va faqat niqob ichida patch-inpainting; niqobdan tashqari piksellar o'zgarmaydi;
//  - sharp — burish (EXIF), chetlarni kesish (trim), qirqish; natija lossless WebP (qayta siqish yo'q;
//    faqat 1600 px dan katta rasmlar bir marta kichraytiriladi);
//  - @imgly/background-removal-node — fonni kesish (faqat alohida tugma bilan).

import sharp from "sharp";
import type { ImageBox } from "../ai/ai.service";
import { cleanWatermarks } from "../ai-import/watermark/clean";

/**
 * Saytdagi rasmning eng uzun tomoni: faqat undan KATTA rasmlar (masalan telefon fotosi 4000 px)
 * bir marta Lanczos bilan kichraytiriladi; bilet rasmlari (~600 px) o'z o'lchamida qoladi.
 */
export const OUTPUT_MAX_SIDE = 1600;
/** Fonni kesish modeli uchun ishchi o'lcham (faqat shu alohida funksiyada). */
const WORK_MAX_SIDE = 1600;
/** Bitta rasmning eng ko'p piksellari (serverless xotira). */
const MAX_INPUT_PIXELS = 40_000_000;

export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type CV = typeof import("@techstark/opencv-js");
// Emscripten moduli "thenable" (then() bor): uni Promise orqali qaytarib
// bo'lmaydi (await cheksiz kutib qoladi) — shuning uchun modul o'zgaruvchida
// saqlanadi, Promise faqat tayyorlikni bildiradi.
let cvModule: CV | null = null;
let cvReady: Promise<void> | null = null;

async function loadCv(): Promise<void> {
  cvReady ??= new Promise<void>((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cv = require("@techstark/opencv-js") as CV & { onRuntimeInitialized?: () => void };
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      cvModule = cv;
      resolve();
    };
    if (cv.Mat) return done();
    cv.onRuntimeInitialized = done;
    // Ba'zi muhitlarda (test runner) hodisa obunadan oldin o'tib ketadi — tayyorlikni tekshirib turamiz.
    const poll = setInterval(() => {
      if (cv.Mat) {
        clearInterval(poll);
        done();
      }
    }, 50);
    poll.unref?.();
  });
  await cvReady;
}

/**
 * OpenCV (WASM) — bir marta yuklanadi; AI import rasm ishlovi ham shundan foydalanadi.
 * Modul "thenable" — async funksiyadan to'g'ridan-to'g'ri qaytarilsa Promise uni cheksiz
 * ochishga urinadi, shuning uchun obyekt ichida qaytariladi.
 */
export async function getCv(): Promise<{ cv: CV }> {
  await loadCv();
  return { cv: cvModule! };
}

/** EXIF bo'yicha burilgan RGB piksellar — ASL o'lchamda (kichraytirilmaydi). */
export async function toWorking(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).rotate().flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Belgilangan hududlardagi (0..1) watermarkni o'chiradi: hudud ichida watermark piksellari aniq
 * ajratiladi (ma'lum shablon bo'lsa — uning shakli), faqat shu niqob patch-inpainting bilan to'ldiriladi.
 */
export async function inpaint(img: { data: Buffer; width: number; height: number }, rects: NormRect[]): Promise<Buffer> {
  if (rects.length === 0) return img.data;
  const result = await cleanWatermarks(img, { boxes: rects });
  return result.image.data;
}

export interface Encoded {
  data: Buffer;
  width: number;
  height: number;
}

/** Yakuniy lossless WebP: ixtiyoriy qirqish (0..1) va chetlarni avtomatik kesish. */
export async function encode(img: { data: Buffer; width: number; height: number }, options: { crop?: NormRect; trim?: boolean }): Promise<Encoded> {
  let pipeline = sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } });
  if (options.crop) {
    const left = Math.max(0, Math.round(options.crop.x * img.width));
    const top = Math.max(0, Math.round(options.crop.y * img.height));
    const width = Math.max(1, Math.min(img.width - left, Math.round(options.crop.w * img.width)));
    const height = Math.max(1, Math.min(img.height - top, Math.round(options.crop.h * img.height)));
    pipeline = sharp(await pipeline.extract({ left, top, width, height }).png().toBuffer());
  }
  if (options.trim) {
    // Bir xil rangdagi ortiqcha chetlar va ramkalar (yuqori-chap piksel rangi bo'yicha).
    const trimmed = await pipeline.png().toBuffer();
    pipeline = sharp(trimmed).trim({ threshold: 18 });
    try {
      await pipeline.clone().toBuffer();
    } catch {
      pipeline = sharp(trimmed); // butun rasm bir xil rangda — kesilmaydi
    }
  }
  // Kattalashtirish yo'q; lossless — bir marta, sifat yo'qolmaydi.
  const { data, info } = await pipeline
    .resize({ width: OUTPUT_MAX_SIDE, height: OUTPUT_MAX_SIDE, fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
    .webp({ lossless: true, effort: 4 }).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** AI uchun kichik JPEG (tokenlarni tejash). */
export async function previewJpeg(img: { data: Buffer; width: number; height: number }): Promise<Buffer> {
  return sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } })
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

/** Fonni kesish (mahalliy ONNX model) — natija oq fonga joylanadi. */
export async function removeBackground(input: Buffer): Promise<Encoded> {
  // Og'ir modul — faqat kerak bo'lganda yuklanadi.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { removeBackground: run } = require("@imgly/background-removal-node") as typeof import("@imgly/background-removal-node");
  const png = await sharp(input).rotate().resize({ width: WORK_MAX_SIDE, height: WORK_MAX_SIDE, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const blob = await run(new Blob([new Uint8Array(png)], { type: "image/png" }), { output: { format: "image/png" } });
  const cut = Buffer.from(await blob.arrayBuffer());
  const { data, info } = await sharp(cut)
    .flatten({ background: "#ffffff" })
    .trim({ threshold: 10 })
    .resize({ width: OUTPUT_MAX_SIDE, height: OUTPUT_MAX_SIDE, fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
    .webp({ lossless: true, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export type { ImageBox };
