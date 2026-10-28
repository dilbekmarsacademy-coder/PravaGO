// Rasmga ishlov berish (tashqi pullik servissiz):
//  - OpenCV (WASM) inpainting — watermark/logotip joylarini atrofidagi piksellar bilan to'ldirish;
//  - sharp — burish (EXIF), chetlarni kesish (trim), qirqish, WebP 1280px / 80;
//  - @imgly/background-removal-node — fonni kesish (faqat alohida tugma bilan).

import sharp from "sharp";
import type { ImageBox } from "../ai/ai.service";

export const OUTPUT_MAX_SIDE = 1280;
export const OUTPUT_QUALITY = 80;
/** Inpainting shu o'lchamgacha kichraytirilgan nusxada bajariladi (tezlik uchun). */
const WORK_MAX_SIDE = 1600;

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
    const done = () => {
      cvModule = cv;
      resolve();
    };
    if (cv.Mat) done();
    else cv.onRuntimeInitialized = done;
  });
  await cvReady;
}

/** EXIF bo'yicha burilgan va ishchi o'lchamga keltirilgan RGB piksellar. */
export async function toWorking(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: WORK_MAX_SIDE, height: WORK_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Belgilangan hududlarni (0..1) OpenCV TELEA inpainting bilan o'chiradi. */
export async function inpaint(img: { data: Buffer; width: number; height: number }, rects: NormRect[]): Promise<Buffer> {
  if (rects.length === 0) return img.data;
  await loadCv();
  const cv = cvModule!;
  const src = new cv.Mat(img.height, img.width, cv.CV_8UC3);
  src.data.set(img.data);
  const mask = cv.Mat.zeros(img.height, img.width, cv.CV_8UC1);
  const dst = new cv.Mat();
  try {
    // Chetlarda yozuv qoldig'i qolmasligi uchun hududni biroz kengaytiramiz.
    const pad = Math.max(2, Math.round(Math.min(img.width, img.height) * 0.006));
    for (const r of rects) {
      const x = Math.max(0, Math.floor(r.x * img.width) - pad);
      const y = Math.max(0, Math.floor(r.y * img.height) - pad);
      const x2 = Math.min(img.width - 1, Math.ceil((r.x + r.w) * img.width) + pad);
      const y2 = Math.min(img.height - 1, Math.ceil((r.y + r.h) * img.height) + pad);
      cv.rectangle(mask, new cv.Point(x, y), new cv.Point(x2, y2), new cv.Scalar(255), -1);
    }
    cv.inpaint(src, mask, dst, 5, cv.INPAINT_TELEA);
    return Buffer.from(dst.data);
  } finally {
    src.delete();
    mask.delete();
    dst.delete();
  }
}

export interface Encoded {
  data: Buffer;
  width: number;
  height: number;
}

/** Yakuniy WebP: ixtiyoriy qirqish (0..1) va chetlarni avtomatik kesish. */
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
  const { data, info } = await pipeline
    .resize({ width: OUTPUT_MAX_SIDE, height: OUTPUT_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: OUTPUT_QUALITY })
    .toBuffer({ resolveWithObject: true });
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
    .resize({ width: OUTPUT_MAX_SIDE, height: OUTPUT_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: OUTPUT_QUALITY })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export type { ImageBox };
