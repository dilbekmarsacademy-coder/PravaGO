// Watermarkni olib tashlash — faqat aniq niqob ichida; niqobdan tashqaridagi piksellar o'zgarmaydi.
//
// 1) Ma'lum watermark shablonlari (hozircha "rulionline.uz": yarim shaffof matn + 60×60 logo) —
//    rasmda joyi qidiriladi (masshtab 1, langar atrofida va AI qutilari atrofida). Topilsa, niqob
//    shablonning AYNAN harf/logo shaklida (taxminiy to'rtburchak emas) + 2 px kengaytma.
// 2) Shablonga tushmagan AI/qo'lda belgilangan qutilar — quti ichida fondan ajralib turgan
//    piksellar aniqlanadi (mahalliy median fon bilan farq); topilmasa yoki overlay butunlay
//    shaffof bo'lmasa (to'liq yopuvchi plashka) — quti o'zi niqob.
// 3) Niqob ichini namuna (patch) asosidagi inpainting to'ldiradi (exemplar.ts); yarim shaffof matn
//    ostida teskari aralashtirish (reverse alpha blending) natijasi yo'naltiruvchi sifatida ishlatiladi —
//    yo'l chizig'i kabi tuzilmalar matn ostidan to'g'ri davom etadi.
// 4) Niqob chetida 2 px feather (kengaytma halqasida asl va yangi piksellar aralashadi) — chegara ko'rinmaydi.
// Rasm o'lchami o'zgarmaydi, qayta siqish yo'q (xom RGB → chaqiruvchi PNG/lossless WebP qiladi).

import sharp from "sharp";
import { getCv } from "../../images/image-processing";
import { exemplarInpaint } from "./exemplar";
import { RULIONLINE } from "./rulionline";

export interface RgbPixels {
  data: Buffer;
  width: number;
  height: number;
}

/** 0..1 — rasm o'lchamiga nisbatan. */
export interface NormBox {
  x: number;
  y: number;
  w: number;
  h: number;
  background?: "smooth" | "complex";
}

export interface CleanRegion {
  kind: "text" | "logo" | "box";
  /** Piksel koordinatalari (niqob chegarasi). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Niqobdagi piksellar soni (kengaytmasiz). */
  pixels: number;
  /** text/logo — shablon mosligi; box — "precise" (aniq shakl) yoki "box" (butun quti). */
  detail: string;
}

export interface CleanResult {
  image: RgbPixels;
  /** 255 — o'zgarishi mumkin bo'lgan piksellar (niqob + feather halqasi), 0 — tegilmagan. */
  mask: Uint8Array;
  regions: CleanRegion[];
  /** Haqiqatda o'zgargan piksellar soni. */
  changed: number;
  /** Niqobdan tashqarida o'zgargan piksellar soni (har doim 0 bo'lishi shart). */
  changedOutside: number;
}

const DILATE = 2;
const FEATHER = 2;
/**
 * Patch tanlashda teskari aralashtirilgan "yo'naltiruvchi" vazni: matn ostidagi tuzilma (yo'l chizig'i,
 * bordyur) to'g'ri davom etadi. Teskari aralashtirish natijasining O'ZI ishlatilmaydi — 13 ta rasmda
 * sinalganda pikseldan kichik siljish va JPEG artefaktlari tufayli harflar "arvohi" qolardi.
 */
const GUIDE_WEIGHT = Number(process.env.WM_GUIDE_WEIGHT ?? 3);
const GUIDE_SIGMA = Number(process.env.WM_GUIDE_SIGMA ?? 2);

async function blurRgb(img: RgbPixels, sigma: number): Promise<Buffer> {
  if (sigma <= 0.3) return img.data;
  return sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } }).blur(sigma).raw().toBuffer();
}

interface TextModel {
  w: number;
  h: number;
  alpha: Float32Array;
  color: Float32Array;
}
interface LogoModel {
  w: number;
  h: number;
  rgb: Buffer;
}

let models: Promise<{ text: TextModel; logo: LogoModel }> | null = null;

function loadModels() {
  models ??= (async () => {
    const t = await sharp(Buffer.from(RULIONLINE.text.pngBase64, "base64")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const n = t.info.width * t.info.height;
    const alpha = new Float32Array(n);
    const color = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      alpha[i] = t.data[i * 4 + 3] / 255;
      for (let c = 0; c < 3; c++) color[i * 3 + c] = t.data[i * 4 + c];
    }
    const l = await sharp(Buffer.from(RULIONLINE.logo.pngBase64, "base64")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return { text: { w: t.info.width, h: t.info.height, alpha, color }, logo: { w: l.info.width, h: l.info.height, rgb: l.data } };
  })();
  return models;
}

/** Yarim shaffof matnni teskari aralashtirish: B = (I − αW) / (1 − α). */
function reverseAt(img: RgbPixels, m: TextModel, ox: number, oy: number, mx: number, my: number, c: number): number {
  const j = my * m.w + mx;
  const a = Math.min(m.alpha[j], 0.85);
  const I = img.data[((oy + my) * img.width + ox + mx) * 3 + c];
  return (I - a * m.color[j * 3 + c]) / (1 - a);
}

/** Matn shabloni joylashuvi bahosi: teskari aralashtirishdan keyingi/oldingi gradient energiyasi nisbati. */
function textScore(img: RgbPixels, m: TextModel, ox: number, oy: number): number {
  if (ox < 0 || oy < 0 || ox + m.w > img.width || oy + m.h > img.height) return Infinity;
  let before = 0;
  let after = 0;
  const W = img.width;
  for (let y = 1; y < m.h; y++) {
    for (let x = 1; x < m.w; x++) {
      const j = y * m.w + x;
      if (!m.alpha[j] && !m.alpha[j - 1] && !m.alpha[j - m.w]) continue;
      const p = ((oy + y) * W + ox + x) * 3;
      for (let c = 0; c < 3; c++) {
        before += Math.abs(img.data[p + c] - img.data[p - 3 + c]) + Math.abs(img.data[p + c] - img.data[p - W * 3 + c]);
        const v = reverseAt(img, m, ox, oy, x, y, c);
        after += Math.abs(v - reverseAt(img, m, ox, oy, x - 1, y, c)) + Math.abs(v - reverseAt(img, m, ox, oy, x, y - 1, c));
      }
    }
  }
  return before > 0 ? after / before : Infinity;
}

/** Logo shabloni: ichki qismning o'rtacha mutlaq farqi (shaffof emas — piksel-piksel mos keladi). */
function logoScore(img: RgbPixels, m: LogoModel, ox: number, oy: number): number {
  if (ox < 0 || oy < 0 || ox + m.w > img.width || oy + m.h > img.height) return Infinity;
  let sum = 0;
  let n = 0;
  for (let y = 4; y < m.h - 4; y++) {
    for (let x = 4; x < m.w - 4; x++) {
      const p = ((oy + y) * img.width + ox + x) * 3;
      const q = (y * m.w + x) * 3;
      for (let c = 0; c < 3; c++) sum += Math.abs(img.data[p + c] - m.rgb[q + c]);
      n += 3;
    }
  }
  return sum / n;
}

export interface KnownHit {
  kind: "text" | "logo";
  x: number;
  y: number;
  score: number;
}

/** Qidiruv joylari: langar atrofi + o'lchami mos AI/qo'lda qutilar atrofi. */
function candidates(anchorX: number, anchorY: number, rx: number, ry: number, w: number, h: number, img: RgbPixels, boxes: NormBox[]): [number, number][] {
  const out = new Map<string, [number, number]>();
  const add = (cx: number, cy: number, sx: number, sy: number) => {
    for (let y = cy - sy; y <= cy + sy; y++) for (let x = cx - sx; x <= cx + sx; x++) out.set(`${x},${y}`, [x, y]);
  };
  add(anchorX, anchorY, rx, ry);
  for (const b of boxes) {
    const bw = b.w * img.width;
    const bh = b.h * img.height;
    if (bw < w * 0.5 || bw > w * 2 || bh < h * 0.4 || bh > h * 3) continue;
    const cx = Math.round(b.x * img.width + bw / 2 - w / 2);
    const cy = Math.round(b.y * img.height + bh / 2 - h / 2);
    add(cx, cy, 16, 16);
  }
  return [...out.values()];
}

/** Ma'lum watermark(lar)ni rasmda topish. */
export async function locateKnown(img: RgbPixels, boxes: NormBox[] = []): Promise<KnownHit[]> {
  const { text, logo } = await loadModels();
  const hits: KnownHit[] = [];
  const W = img.width;
  const H = img.height;
  if (W >= text.w + 4 && H >= text.h + 4) {
    let best: KnownHit | null = null;
    for (const [x, y] of candidates(Math.floor(W / 2) + RULIONLINE.text.anchor.dx, H + RULIONLINE.text.anchor.dy, 6, 10, text.w, text.h, img, boxes)) {
      const s = textScore(img, text, x, y);
      if (!best || s < best.score) best = { kind: "text", x, y, score: s };
    }
    // Teskari aralashtirish matn chetlarini kamida 15% "silliqlasa" — watermark shu yerda.
    if (best && best.score < 0.85) hits.push(best);
  }
  if (W >= logo.w + 4 && H >= logo.h + 4) {
    let best: KnownHit | null = null;
    for (const [x, y] of candidates(W + RULIONLINE.logo.anchor.dx, H + RULIONLINE.logo.anchor.dy, 8, 8, logo.w, logo.h, img, boxes)) {
      const s = logoScore(img, logo, x, y);
      if (!best || s < best.score) best = { kind: "logo", x, y, score: s };
    }
    if (best && best.score < 14) hits.push(best);
  }
  return hits;
}

function dilate(mask: Uint8Array, W: number, H: number, r: number): Uint8Array {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        const Y = y + dy;
        if (Y < 0 || Y >= H) continue;
        for (let dx = -r; dx <= r; dx++) {
          const X = x + dx;
          if (X < 0 || X >= W || dx * dx + dy * dy > r * r + r) continue;
          out[Y * W + X] = 1;
        }
      }
    }
  }
  return out;
}

/**
 * Quti ichida watermark piksellari: mahalliy median fondan sezilarli farq qiladiganlari
 * (chegara — quti atrofidagi halqa shovqiniga qarab). Natija: 0/1 niqob va usul nomi.
 */
async function preciseBoxMask(img: RgbPixels, box: NormBox): Promise<{ mask: Uint8Array; detail: "precise" | "box"; pixels: number }> {
  const { cv } = await getCv();
  const W = img.width;
  const H = img.height;
  const x0 = Math.max(0, Math.floor(box.x * W));
  const y0 = Math.max(0, Math.floor(box.y * H));
  const x1 = Math.min(W, Math.ceil((box.x + box.w) * W));
  const y1 = Math.min(H, Math.ceil((box.y + box.h) * H));
  const mask = new Uint8Array(W * H);
  if (x1 - x0 < 2 || y1 - y0 < 2) return { mask, detail: "box", pixels: 0 };
  const fillBox = () => {
    for (let y = y0; y < y1; y++) mask.fill(1, y * W + x0, y * W + x1);
    return { mask, detail: "box" as const, pixels: (x1 - x0) * (y1 - y0) };
  };
  // Ish hududi: quti + halqa.
  const ring = Math.max(8, Math.round(Math.min(x1 - x0, y1 - y0) * 0.5));
  const rx0 = Math.max(0, x0 - ring);
  const ry0 = Math.max(0, y0 - ring);
  const rx1 = Math.min(W, x1 + ring);
  const ry1 = Math.min(H, y1 + ring);
  const rw = rx1 - rx0;
  const rh = ry1 - ry0;
  const gray = new Uint8Array(rw * rh);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const p = ((ry0 + y) * W + rx0 + x) * 3;
      gray[y * rw + x] = Math.round(img.data[p] * 0.299 + img.data[p + 1] * 0.587 + img.data[p + 2] * 0.114);
    }
  }
  const src = new cv.Mat(rh, rw, cv.CV_8UC1);
  src.data.set(gray);
  const med = new cv.Mat();
  const k = Math.max(7, (Math.round(Math.min(x1 - x0, y1 - y0) * 0.6) | 1));
  try {
    cv.medianBlur(src, med, Math.min(k, 31));
    const dev = new Float32Array(rw * rh);
    for (let i = 0; i < rw * rh; i++) dev[i] = Math.abs(gray[i] - med.data[i]);
    // Halqa (quti tashqarisi) shovqini.
    const ringVals: number[] = [];
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        const X = rx0 + x;
        const Y = ry0 + y;
        if (X >= x0 && X < x1 && Y >= y0 && Y < y1) continue;
        ringVals.push(dev[y * rw + x]);
      }
    }
    ringVals.sort((a, b) => a - b);
    const p90 = ringVals.length ? ringVals[Math.floor(ringVals.length * 0.9)] : 8;
    const thr = Math.max(14, p90 * 1.5);
    let n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (dev[(y - ry0) * rw + (x - rx0)] > thr) {
          mask[y * W + x] = 1;
          n++;
        }
      }
    }
    const area = (x1 - x0) * (y1 - y0);
    // Hech narsa ajralmadi yoki overlay qutining ko'p qismini to'liq yopgan (plashka) — butun quti.
    if (n < area * 0.02 || n > area * 0.6) return fillBox();
    // Harf ichidagi bo'shliqlarni yopish: 1 px kengaytirish (quti ichida).
    const grown = dilate(mask, W, H, 1);
    let m = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * W + x;
        mask[i] = grown[i];
        m += mask[i];
      }
    }
    return { mask, detail: "precise", pixels: m };
  } finally {
    src.delete();
    med.delete();
  }
}

/**
 * Watermarkni tozalash. `boxes` — AI yoki admin belgilagan qutilar (0..1); `known` — ma'lum
 * shablonlarni qidirish. Hech narsa topilmasa — rasm o'zgarmaydi (regions bo'sh).
 */
export async function cleanWatermarks(img: RgbPixels, options: { boxes?: NormBox[]; known?: boolean } = {}): Promise<CleanResult> {
  const W = img.width;
  const H = img.height;
  const boxes = options.boxes ?? [];
  const regions: CleanRegion[] = [];
  const core = new Uint8Array(W * H); // watermark piksellari (kengaytmasiz) — to'liq almashtiriladi
  const guideMask = new Uint8Array(W * H);
  const guide = Buffer.from(img.data);
  const covered: { x: number; y: number; w: number; h: number }[] = [];

  if (options.known !== false) {
    const { text, logo } = await loadModels();
    for (const hit of await locateKnown(img, boxes)) {
      if (hit.kind === "text") {
        let n = 0;
        for (let y = 0; y < text.h; y++) {
          for (let x = 0; x < text.w; x++) {
            const j = y * text.w + x;
            if (!text.alpha[j]) continue;
            const i = (hit.y + y) * W + hit.x + x;
            for (let c = 0; c < 3; c++) guide[i * 3 + c] = Math.max(0, Math.min(255, Math.round(reverseAt(img, text, hit.x, hit.y, x, y, c))));
            core[i] = 1;
            guideMask[i] = 1;
            n++;
          }
        }
        regions.push({ kind: "text", x: hit.x, y: hit.y, w: text.w, h: text.h, pixels: n, detail: `${RULIONLINE.id} matn, moslik ${(1 - hit.score).toFixed(2)}` });
        covered.push({ x: hit.x, y: hit.y, w: text.w, h: text.h });
      } else {
        for (let y = 0; y < logo.h; y++) core.fill(1, (hit.y + y) * W + hit.x, (hit.y + y) * W + hit.x + logo.w);
        regions.push({ kind: "logo", x: hit.x, y: hit.y, w: logo.w, h: logo.h, pixels: logo.w * logo.h, detail: `${RULIONLINE.id} logo, farq ${hit.score.toFixed(1)}` });
        covered.push({ x: hit.x, y: hit.y, w: logo.w, h: logo.h });
      }
    }
  }

  for (const b of boxes) {
    // Shablon allaqachon qoplagan quti — qayta ishlanmaydi (aks holda butun to'rtburchak bo'yalardi).
    const bx = b.x * W;
    const by = b.y * H;
    const bw = b.w * W;
    const bh = b.h * H;
    const overlap = covered.some((c) => {
      const ix = Math.max(0, Math.min(bx + bw, c.x + c.w) - Math.max(bx, c.x));
      const iy = Math.max(0, Math.min(by + bh, c.y + c.h) - Math.max(by, c.y));
      return ix * iy >= 0.4 * bw * bh;
    });
    if (overlap) continue;
    const r = await preciseBoxMask(img, b);
    if (!r.pixels) continue;
    for (let i = 0; i < W * H; i++) if (r.mask[i]) core[i] = 1;
    regions.push({ kind: "box", x: Math.round(bx), y: Math.round(by), w: Math.round(bw), h: Math.round(bh), pixels: r.pixels, detail: r.detail });
  }

  if (!regions.length) return { image: { ...img, data: Buffer.from(img.data) }, mask: new Uint8Array(W * H), regions, changed: 0, changedOutside: 0 };

  // Teshik = watermark + 2 px kengaytma (chetdagi antialias piksellar qolmasin).
  const hole = dilate(core, W, H, DILATE);
  // Yo'naltiruvchidagi ingichka "arvoh" konturlarni yo'qotish: faqat yirik tuzilma qoladi.
  const smoothGuide = await blurRgb({ data: guide, width: W, height: H }, GUIDE_SIGMA);
  const filled = exemplarInpaint(img.data, W, H, hole, { radius: 4, search: 60, guide: smoothGuide, guideMask, guideWeight: GUIDE_WEIGHT });

  // Feather: teshik chetidan masofa (1..FEATHER) bo'yicha asl bilan aralashtirish.
  const dist = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) dist[i] = hole[i] ? 255 : 0;
  for (let d = 1; d <= FEATHER; d++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (dist[i] !== 255) continue;
        const edge = (x > 0 && dist[i - 1] === d - 1) || (x < W - 1 && dist[i + 1] === d - 1) || (y > 0 && dist[i - W] === d - 1) || (y < H - 1 && dist[i + W] === d - 1);
        if (edge) dist[i] = d;
      }
    }
  }
  const out = Buffer.from(img.data);
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (!hole[i]) continue;
    mask[i] = 255;
    // Watermark pikselining o'zi har doim to'liq almashtiriladi; feather faqat kengaytma halqasida.
    const w = core[i] ? 1 : Math.min(1, dist[i] / (FEATHER + 1));
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(w * filled[i * 3 + c] + (1 - w) * img.data[i * 3 + c]);
  }
  let changed = 0;
  let changedOutside = 0;
  for (let i = 0; i < W * H; i++) {
    const diff = out[i * 3] !== img.data[i * 3] || out[i * 3 + 1] !== img.data[i * 3 + 1] || out[i * 3 + 2] !== img.data[i * 3 + 2];
    if (!diff) continue;
    if (mask[i]) changed++;
    else changedOutside++;
  }
  return { image: { data: out, width: W, height: H }, mask, regions, changed, changedOutside };
}
