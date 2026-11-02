// AI import rasmlariga ishlov berish — to'liq backend ichida, bepul kutubxonalar bilan:
//  - watermark joylari bo'yicha niqob (biroz kengaytiriladi — dilate) va OpenCV inpainting:
//    INPAINT_TELEA va INPAINT_NS, natijasi fonga eng mos kelgani tanlanadi;
//  - chetdagi watermark (rasmning ≤ 12% qismida) — kesish (crop) varianti;
//  - "watermark namunasi" bo'lsa — template matching (bir necha masshtabda);
//  - master nusxa: Lanczos3 + yengil sharpen, eng uzun tomoni ≤ 3840 px va asldan ≤ 2×;
//  - saytda ko'rsatish uchun WebP 800 va 1600 px (sifat ~82); AI uchun JPEG ≤ 1568 px.

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
export const MASTER_MAX_SIDE = 3840;
export const MASTER_MAX_SCALE = 2;
export const VARIANT_SIZES = [800, 1600] as const;
export const VARIANT_QUALITY = 82;
/** Crop faqat watermark chetdagi shu qismda bo'lsa (12%). */
export const EDGE_BAND = 0.12;
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

/** Niqob atrofidagi halqa (fon namunasi) — niqobdan `ring` px uzoqlikkacha. */
function ringMask(width: number, height: number, boxes: Box[], dilatePx: number, ring: number): Uint8Array {
  const inner = boxMask(width, height, boxes, dilatePx);
  const outer = boxMask(width, height, boxes, dilatePx + ring);
  for (let i = 0; i < inner.length; i++) if (inner[i]) outer[i] = 0;
  return outer;
}

/** Hududdagi yorqinlik gradientining o'rtachasi — tekstura "darajasi". */
function gradientEnergy(img: RgbImage, mask: Uint8Array): number {
  const { data, width, height } = img;
  const lum = (i: number) => (data[i * 3] * 299 + data[i * 3 + 1] * 587 + data[i * 3 + 2] * 114) / 1000;
  let sum = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      sum += Math.abs(lum(i + 1) - lum(i - 1)) + Math.abs(lum(i + width) - lum(i - width));
      n++;
    }
  }
  return n ? sum / n : 0;
}

export interface InpaintResult {
  image: RgbImage;
  method: "telea" | "ns";
  /** |tekstura(ichkari) − tekstura(atrof)| — kichigi fonga mosroq. */
  score: number;
}

/**
 * TELEA va NS bilan inpaint; atrofdagi fonga teksturasi yaqinrog'i tanlanadi
 * (silliq fonda — dog' qolmasligi, murakkab fonda — "yuvilib" qolmasligi).
 */
export async function inpaintBest(img: RgbImage, boxes: Box[]): Promise<InpaintResult> {
  const { cv } = await getCv();
  const dilatePx = Math.max(3, Math.round(Math.min(img.width, img.height) * 0.012));
  const maskBytes = boxMask(img.width, img.height, boxes, dilatePx);
  const ring = ringMask(img.width, img.height, boxes, dilatePx, Math.max(6, dilatePx * 3));
  const target = gradientEnergy(img, ring);
  const src = new cv.Mat(img.height, img.width, cv.CV_8UC3);
  src.data.set(img.data);
  const mask = new cv.Mat(img.height, img.width, cv.CV_8UC1);
  mask.data.set(maskBytes);
  const radius = Math.max(3, Math.round(dilatePx * 1.5));
  const results: InpaintResult[] = [];
  try {
    for (const method of ["telea", "ns"] as const) {
      const dst = new cv.Mat();
      try {
        cv.inpaint(src, mask, dst, radius, method === "telea" ? cv.INPAINT_TELEA : cv.INPAINT_NS);
        const image = { data: Buffer.from(dst.data), width: img.width, height: img.height };
        results.push({ image, method, score: Math.abs(gradientEnergy(image, maskBytes) - target) });
      } finally {
        dst.delete();
      }
    }
  } finally {
    src.delete();
    mask.delete();
  }
  const preferNs = boxes.some((b) => b.background === "complex");
  results.sort((a, b) => a.score - b.score || (preferNs ? (a.method === "ns" ? -1 : 1) : 0));
  return results[0];
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

/** Master: Lanczos3 + yengil sharpen; ≤ 3840 px va asldan ≤ 2×. WebP (sifat 92). */
export async function makeMaster(img: RgbImage): Promise<{ data: Buffer; width: number; height: number }> {
  const longest = Math.max(img.width, img.height);
  const scale = Math.min(MASTER_MAX_SCALE, MASTER_MAX_SIDE / longest);
  const width = Math.round(img.width * Math.max(1, scale));
  const height = Math.round(img.height * Math.max(1, scale));
  let pipeline = sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } });
  if (scale > 1) pipeline = pipeline.resize(width, height, { kernel: "lanczos3" }).sharpen({ sigma: 0.8, m1: 0.5, m2: 1.5 });
  const data = await pipeline.webp({ quality: 92 }).toBuffer();
  return { data, width: scale > 1 ? width : img.width, height: scale > 1 ? height : img.height };
}

/** Saytdagi WebP variantlar (800 va 1600 px). */
export async function makeVariants(master: Buffer): Promise<{ size: number; data: Buffer; width: number; height: number }[]> {
  const out: { size: number; data: Buffer; width: number; height: number }[] = [];
  for (const size of VARIANT_SIZES) {
    const { data, info } = await sharp(master)
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
      .webp({ quality: VARIANT_QUALITY })
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
