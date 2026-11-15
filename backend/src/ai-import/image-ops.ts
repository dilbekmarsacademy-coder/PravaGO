// AI import rasmlariga ishlov berish — to'liq backend ichida, bepul kutubxonalar bilan.
// SIFAT QOIDASI: rasm o'lchami o'zgarmaydi (kichraytirish/kattalashtirish yo'q), oraliq va yakuniy
// nusxalar faqat yo'qotishsiz (PNG / lossless WebP) — rasm bir marta ham qayta siqilmaydi.
//  - watermark: watermark/clean.ts — ma'lum shablon (aniq harf/logo shakli) yoki quti ichidagi aniq
//    niqob, niqob ichida patch-inpainting; niqobdan tashqari piksellar asl bilan bir xil;
//  - chetdagi watermark (rasmning ≤ 12% qismida) — kesish (crop) varianti (kesilgandan keyin resize yo'q);
//  - "watermark namunasi" bo'lsa — template matching (bir necha masshtabda) — AI qutisi sifatida;
//  - saytdagi variantlar: lossless WebP; 1600 / 800 px dan katta rasmlargina kichraytiriladi (Lanczos3).
//    AI uchun alohida JPEG ≤ 1568 px (faqat tahlil uchun, saytga chiqmaydi).

import { createHash } from "crypto";
import sharp from "sharp";
import { getCv } from "../images/image-processing";

export interface Box {
  /** 0..1 — rasm o'lchamiga nisbatan. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** smooth — oddiy/silliq fon, complex — murakkab/teksturali. */
  background?: "smooth" | "complex";
}

export interface RgbImage {
  data: Buffer;
  width: number;
  height: number;
}

export const AI_MAX_SIDE = 1568;
export const VARIANT_SIZES = [800, 1600] as const;
/** Crop faqat watermark chetdagi shu qismda bo'lsa (12%). */
export const EDGE_BAND = 0.12;
/** Bitta rasmning eng ko'p piksellari (xotira — serverless; 40 MP ≈ 120 MB RGB). */
export const MAX_INPUT_PIXELS = 40_000_000;
/** Ishlov uchun eng katta o'lcham (xotira — serverless). */
const WORK_MAX_SIDE = 2400;

export function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function toRgb(input: Buffer, maxSide = WORK_MAX_SIDE): Promise<RgbImage> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Asl o'lchamda (kichraytirmasdan) RGB: EXIF burilishi, shaffof fon → oq. Sifat yo'qotilmaydi. */
export async function decodeRgb(input: Buffer): Promise<RgbImage> {
  const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).rotate().flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export function rgbToPng(img: RgbImage): Promise<Buffer> {
  return sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } }).png().toBuffer();
}

/** AI (vision) uchun: eng uzun tomoni ≤ 1568 px JPEG (token tejash). */
export async function aiJpeg(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: AI_MAX_SIDE, height: AI_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function clampBox(b: Box): Box {
  const x = Math.min(1, Math.max(0, b.x));
  const y = Math.min(1, Math.max(0, b.y));
  return { ...b, x, y, w: Math.min(1 - x, Math.max(0, b.w)), h: Math.min(1 - y, Math.max(0, b.h)) };
}

/** Niqob: to'rtburchaklar (piksel) + dilate. Natija — 0/255 bayt massivi. */
export function boxMask(width: number, height: number, boxes: Box[], dilatePx = Math.max(3, Math.round(Math.min(width, height) * 0.012))): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (const raw of boxes) {
    const b = clampBox(raw);
    const x0 = Math.max(0, Math.floor(b.x * width) - dilatePx);
    const y0 = Math.max(0, Math.floor(b.y * height) - dilatePx);
    const x1 = Math.min(width, Math.ceil((b.x + b.w) * width) + dilatePx);
    const y1 = Math.min(height, Math.ceil((b.y + b.h) * height) + dilatePx);
    for (let y = y0; y < y1; y++) mask.fill(255, y * width + x0, y * width + x1);
  }
  return mask;
}

/**
 * Chetdagi watermark uchun crop: barcha qutilar bitta chetda (≤ 12% chiziqda) bo'lsa
 * va kesish rasmning ≤ 12% qismini olib tashlasa — kesish oralig'i (0..1), aks holda null.
 */
export function edgeCrop(boxes: Box[]): { x: number; y: number; w: number; h: number } | null {
  if (!boxes.length) return null;
  const bs = boxes.map(clampBox);
  const pad = 0.01;
  const bottom = bs.every((b) => b.y >= 1 - EDGE_BAND) ? Math.min(...bs.map((b) => b.y)) - pad : null;
  const top = bs.every((b) => b.y + b.h <= EDGE_BAND) ? Math.max(...bs.map((b) => b.y + b.h)) + pad : null;
  const right = bs.every((b) => b.x >= 1 - EDGE_BAND) ? Math.min(...bs.map((b) => b.x)) - pad : null;
  const left = bs.every((b) => b.x + b.w <= EDGE_BAND) ? Math.max(...bs.map((b) => b.x + b.w)) + pad : null;
  if (bottom !== null && 1 - bottom <= EDGE_BAND + pad) return { x: 0, y: 0, w: 1, h: Math.max(0.5, bottom) };
  if (top !== null && top <= EDGE_BAND + pad) return { x: 0, y: top, w: 1, h: 1 - top };
  if (right !== null && 1 - right <= EDGE_BAND + pad) return { x: 0, y: 0, w: Math.max(0.5, right), h: 1 };
  if (left !== null && left <= EDGE_BAND + pad) return { x: left, y: 0, w: 1 - left, h: 1 };
  return null;
}

export async function cropRgb(img: RgbImage, r: { x: number; y: number; w: number; h: number }): Promise<RgbImage> {
  const left = Math.round(r.x * img.width);
  const top = Math.round(r.y * img.height);
  const width = Math.max(1, Math.min(img.width - left, Math.round(r.w * img.width)));
  const height = Math.max(1, Math.min(img.height - top, Math.round(r.h * img.height)));
  const { data, info } = await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } })
    .extract({ left, top, width, height })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Namunani (logotip) rasmda qidirish: TM_CCOEFF_NORMED, bir necha masshtab; topilsa — quti. */
export async function templateMatch(img: RgbImage, template: Buffer, threshold = 0.72): Promise<Box | null> {
  const { cv } = await getCv();
  const tpl = await toRgb(template, 800);
  const src = new cv.Mat(img.height, img.width, cv.CV_8UC3);
  src.data.set(img.data);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGB2GRAY);
  let best: { score: number; box: Box } | null = null;
  try {
    for (const scale of [0.5, 0.75, 1, 1.25, 1.5]) {
      const w = Math.round(tpl.width * scale * (img.width / 1000));
      const h = Math.round(tpl.height * scale * (img.width / 1000));
      if (w < 8 || h < 8 || w >= img.width || h >= img.height) continue;
      const small = await sharp(tpl.data, { raw: { width: tpl.width, height: tpl.height, channels: 3 } }).resize(w, h).greyscale().raw().toBuffer();
      const t = new cv.Mat(h, w, cv.CV_8UC1);
      t.data.set(small);
      const res = new cv.Mat();
      const noMask = new cv.Mat();
      try {
        cv.matchTemplate(gray, t, res, cv.TM_CCOEFF_NORMED);
        const mm = cv.minMaxLoc(res, noMask);
        if (mm.maxVal >= threshold && (!best || mm.maxVal > best.score)) {
          best = { score: mm.maxVal, box: { x: mm.maxLoc.x / img.width, y: mm.maxLoc.y / img.height, w: w / img.width, h: h / img.height } };
        }
      } finally {
        t.delete();
        res.delete();
        noMask.delete();
      }
    }
  } finally {
    src.delete();
    gray.delete();
  }
  return best?.box ?? null;
}

/** Master: asl o'lchamdagi lossless WebP (resize, sharpen va qayta siqish yo'q). */
export async function makeMaster(img: RgbImage): Promise<{ data: Buffer; width: number; height: number }> {
  const data = await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } }).webp({ lossless: true, effort: 4 }).toBuffer();
  return { data, width: img.width, height: img.height };
}

/**
 * Saytdagi variantlar (800 va 1600): lossless WebP. Rasm shu o'lchamdan kichik bo'lsa — kattalashtirilmaydi
 * va master baytlari o'zgarishsiz ishlatiladi (qayta encode ham yo'q).
 */
export async function makeVariants(master: Buffer): Promise<{ size: number; data: Buffer; width: number; height: number }[]> {
  const meta = await sharp(master).metadata();
  const out: { size: number; data: Buffer; width: number; height: number }[] = [];
  for (const size of VARIANT_SIZES) {
    if (Math.max(meta.width ?? 0, meta.height ?? 0) <= size) {
      out.push({ size, data: master, width: meta.width ?? 0, height: meta.height ?? 0 });
      continue;
    }
    const { data, info } = await sharp(master)
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
      .webp({ lossless: true, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    out.push({ size, data, width: info.width, height: info.height });
  }
  return out;
}

/** Ikki rasm (bir xil o'lcham) farqi niqob ichida — tozalash natijasi tekshiruvi uchun. */
export function meanDiff(a: RgbImage, b: RgbImage, mask?: Uint8Array): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < a.width * a.height; i++) {
    if (mask && !mask[i]) continue;
    sum += Math.abs(a.data[i * 3] - b.data[i * 3]) + Math.abs(a.data[i * 3 + 1] - b.data[i * 3 + 1]) + Math.abs(a.data[i * 3 + 2] - b.data[i * 3 + 2]);
    n++;
  }
  return n ? sum / (n * 3) : 0;
}
