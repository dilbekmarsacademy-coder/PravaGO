// Namuna (patch) asosidagi inpainting — Criminisi va boshq. (2004) usulining soddalashtirilgan varianti.
// Teshik (niqob) atrofdagi HAQIQIY piksellardan ko'chirilgan bo'laklar bilan to'ldiriladi:
// xiralashtirish (blur) yoki silliq "dog'" emas, tekstura (asfalt, o't, devor) saqlanadi.
//  - ustuvorlik = ishonch (atrof qancha ma'lum) × chiziq kuchi (izofota) → avval chegara va
//    chiziqlar (yo'l chizig'i, bordyur) davom ettiriladi;
//  - qidiruv faqat nuqta atrofidagi oynada (tezlik va mahalliy moslik uchun);
//  - ixtiyoriy `guide` — teshik ichidagi taxminiy rasm (masalan yarim shaffof watermark teskari
//    aralashtirilgan natija): mos bo'lak tanlashda kichik vazn bilan hisobga olinadi.
// Niqobdan tashqaridagi piksellarga tegilmaydi.

export interface ExemplarOptions {
  /** Bo'lak radiusi (bo'lak = (2r+1)²). */
  radius?: number;
  /** Qidiruv oynasi radiusi (px). */
  search?: number;
  /** Teshik ichidagi taxminiy rasm (RGB, butun rasm o'lchamida). */
  guide?: Uint8Array | Buffer | null;
  /** guide vazni (0..1) — ma'lum piksellarga nisbatan. */
  guideWeight?: number;
  /** guide qaysi piksellarda ishonchli (0/1); berilmasa — butun teshikda. */
  guideMask?: Uint8Array | null;
}

/**
 * `data` (RGB, W×H) ichida `hole` (0/1, W×H) piksellarini to'ldiradi — natija yangi bufer.
 * Manba bo'laklari faqat to'liq ma'lum (teshiksiz) joylardan olinadi.
 */
export function exemplarInpaint(data: Uint8Array | Buffer, width: number, height: number, hole: Uint8Array, options: ExemplarOptions = {}): Buffer {
  const r = options.radius ?? 4;
  const search = options.search ?? 56;
  const guide = options.guide ?? null;
  const gw = options.guideWeight ?? 0.35;
  const guideMask = options.guideMask ?? null;
  const W = width;
  const H = height;
  const out = Buffer.from(data);
  const unknown = Uint8Array.from(hole, (v) => (v ? 1 : 0));
  let remaining = 0;
  let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!unknown[y * W + x]) continue;
      remaining++;
      if (x < bx0) bx0 = x;
      if (y < by0) by0 = y;
      if (x > bx1) bx1 = x;
      if (y > by1) by1 = y;
    }
  }
  if (!remaining) return out;

  // Manba uchun ruxsat: bo'lak to'liq rasm ichida va (boshlang'ich) teshikka tegmaydi.
  // Integral tasvir bilan tekshiriladi.
  const integ = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += unknown[y * W + x];
      integ[(y + 1) * (W + 1) + x + 1] = integ[y * (W + 1) + x + 1] + row;
    }
  }
  const holeCount = (x0: number, y0: number, x1: number, y1: number) =>
    integ[(y1 + 1) * (W + 1) + x1 + 1] - integ[y0 * (W + 1) + x1 + 1] - integ[(y1 + 1) * (W + 1) + x0] + integ[y0 * (W + 1) + x0];
  const validSource = new Uint8Array(W * H);
  for (let y = r; y < H - r; y++) {
    for (let x = r; x < W - r; x++) {
      if (holeCount(x - r, y - r, x + r, y + r) === 0) validSource[y * W + x] = 1;
    }
  }

  const conf = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) conf[i] = unknown[i] ? 0 : 1;

  // Yorqinlik gradienti (faqat ma'lum piksellar bo'yicha) — izofota uchun.
  const lum = (i: number) => out[i * 3] * 0.299 + out[i * 3 + 1] * 0.587 + out[i * 3 + 2] * 0.114;

  const priority = (px: number, py: number): number => {
    let c = 0;
    let n = 0;
    let gBest = 0;
    let gx = 0;
    let gy = 0;
    for (let y = Math.max(0, py - r); y <= Math.min(H - 1, py + r); y++) {
      for (let x = Math.max(0, px - r); x <= Math.min(W - 1, px + r); x++) {
        const i = y * W + x;
        c += conf[i];
        n++;
        if (unknown[i] || x === 0 || y === 0 || x === W - 1 || y === H - 1) continue;
        if (unknown[i - 1] || unknown[i + 1] || unknown[i - W] || unknown[i + W]) continue;
        const dx = (lum(i + 1) - lum(i - 1)) / 2;
        const dy = (lum(i + W) - lum(i - W)) / 2;
        const g = dx * dx + dy * dy;
        if (g > gBest) {
          gBest = g;
          gx = dx;
          gy = dy;
        }
      }
    }
    // Teshik chegarasi normali (niqob gradienti).
    const m = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : unknown[y * W + x]);
    let nx = m(px + 1, py) - m(px - 1, py);
    let ny = m(px, py + 1) - m(px, py - 1);
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    // Izofota = gradientga perpendikulyar.
    const data = Math.abs(-gy * nx + gx * ny) / 255;
    return (c / n) * (data + 0.02);
  };

  const isFront = (x: number, y: number) => {
    const i = y * W + x;
    if (!unknown[i]) return false;
    return (x > 0 && !unknown[i - 1]) || (x < W - 1 && !unknown[i + 1]) || (y > 0 && !unknown[i - W]) || (y < H - 1 && !unknown[i + W]);
  };

  // Front va ustuvorliklar keshi.
  const prio = new Map<number, number>();
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (isFront(x, y)) prio.set(y * W + x, priority(x, y));

  const area = (2 * r + 1) * (2 * r + 1);
  let guard = remaining * 2 + 100;
  while (remaining > 0 && guard-- > 0) {
    // Eng yuqori ustuvorlikdagi nuqta.
    let best = -1;
    let bestP = -1;
    for (const [i, p] of prio) {
      if (p > bestP) {
        bestP = p;
        best = i;
      }
    }
    if (best < 0) {
      // Front yo'q (teshik izolyatsiya) — qolganini qayta yig'amiz.
      for (let i = 0; i < W * H; i++) if (unknown[i] && isFront(i % W, (i / W) | 0)) prio.set(i, priority(i % W, (i / W) | 0));
      if (!prio.size) break;
      continue;
    }
    const px = best % W;
    const py = (best / W) | 0;

    // Eng mos manba bo'lagi (SSD: ma'lum piksellar + guide bo'yicha teshik piksellari).
    const sx0 = Math.max(r, px - search);
    const sx1 = Math.min(W - 1 - r, px + search);
    const sy0 = Math.max(r, py - search);
    const sy1 = Math.min(H - 1 - r, py + search);
    // Maqsad bo'lagidagi piksellar ro'yxati (rasm ichidagilari).
    const offs: number[] = [];
    const known: number[] = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = px + dx;
        const y = py + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        offs.push(dy * W + dx);
        known.push(unknown[y * W + x] ? 0 : 1);
      }
    }
    let bestCost = Infinity;
    let src = -1;
    for (let sy = sy0; sy <= sy1; sy++) {
      for (let sx = sx0; sx <= sx1; sx++) {
        const s = sy * W + sx;
        if (!validSource[s]) continue;
        let cost = 0;
        for (let k = 0; k < offs.length && cost < bestCost; k++) {
          const t = best + offs[k];
          const q = s + offs[k];
          let d0, d1, d2, w;
          if (known[k]) {
            d0 = out[t * 3] - out[q * 3];
            d1 = out[t * 3 + 1] - out[q * 3 + 1];
            d2 = out[t * 3 + 2] - out[q * 3 + 2];
            w = 1;
          } else if (guide && (!guideMask || guideMask[t])) {
            d0 = guide[t * 3] - out[q * 3];
            d1 = guide[t * 3 + 1] - out[q * 3 + 1];
            d2 = guide[t * 3 + 2] - out[q * 3 + 2];
            w = gw;
          } else continue;
          cost += w * (d0 * d0 + d1 * d1 + d2 * d2);
        }
        // Yaqin bo'lakka kichik ustunlik (takroriy naqshlarni kamaytiradi).
        cost += ((sx - px) * (sx - px) + (sy - py) * (sy - py)) * 0.02 * area;
        if (cost < bestCost) {
          bestCost = cost;
          src = s;
        }
      }
    }
    if (src < 0) {
      // Oynada manba yo'q — qidiruvni kengaytirish o'rniga eng yaqin ma'lum piksel bilan to'ldiramiz.
      prio.delete(best);
      fillNearest(out, unknown, W, H, px, py);
      unknown[best] = 0;
      conf[best] = 0.5;
      remaining--;
      continue;
    }

    // Ko'chirish va ishonchni yangilash.
    const c = confOf(conf, W, H, px, py, r);
    for (let k = 0; k < offs.length; k++) {
      if (known[k]) continue;
      const t = best + offs[k];
      const q = src + offs[k];
      out[t * 3] = out[q * 3];
      out[t * 3 + 1] = out[q * 3 + 1];
      out[t * 3 + 2] = out[q * 3 + 2];
      unknown[t] = 0;
      conf[t] = c;
      prio.delete(t);
      remaining--;
    }
    // Atrofdagi front ustuvorliklarini yangilash.
    for (let y = Math.max(0, py - 2 * r - 1); y <= Math.min(H - 1, py + 2 * r + 1); y++) {
      for (let x = Math.max(0, px - 2 * r - 1); x <= Math.min(W - 1, px + 2 * r + 1); x++) {
        const i = y * W + x;
        if (isFront(x, y)) prio.set(i, priority(x, y));
        else prio.delete(i);
      }
    }
  }
  return out;
}

function confOf(conf: Float32Array, W: number, H: number, px: number, py: number, r: number): number {
  let c = 0;
  let n = 0;
  for (let y = Math.max(0, py - r); y <= Math.min(H - 1, py + r); y++) {
    for (let x = Math.max(0, px - r); x <= Math.min(W - 1, px + r); x++) {
      c += conf[y * W + x];
      n++;
    }
  }
  return n ? c / n : 0;
}

function fillNearest(out: Buffer, unknown: Uint8Array, W: number, H: number, px: number, py: number): void {
  for (let d = 1; d < Math.max(W, H); d++) {
    for (let y = Math.max(0, py - d); y <= Math.min(H - 1, py + d); y++) {
      for (let x = Math.max(0, px - d); x <= Math.min(W - 1, px + d); x++) {
        const i = y * W + x;
        if (unknown[i]) continue;
        const t = py * W + px;
        out[t * 3] = out[i * 3];
        out[t * 3 + 1] = out[i * 3 + 1];
        out[t * 3 + 2] = out[i * 3 + 2];
        return;
      }
    }
  }
}
