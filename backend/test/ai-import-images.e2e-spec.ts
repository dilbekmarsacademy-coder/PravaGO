import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { cropRgb, decodeRgb, edgeCrop, makeMaster, makeVariants, meanDiff, rgbToPng, sha256, templateMatch, toRgb, type RgbImage } from "../src/ai-import/image-ops";
import { cleanWatermarks, locateKnown } from "../src/ai-import/watermark/clean";
import { RULIONLINE } from "../src/ai-import/watermark/rulionline";
import { makeImage } from "./helpers/import-fixtures";

// Watermark tozalash: toza rasm + watermark → aniq niqob + patch-inpainting → niqobdan tashqari
// piksellar AYNAN bir xil, o'lcham o'zgarmaydi. Natijalar test/output/watermark/ ga yoziladi.
const OUT = join(process.cwd(), "test", "output", "watermark");

/** "rulionline.uz" watermarkini (matn — alfa bilan, logo — shaffof emas) haqiqiy joyiga qo'yish. */
async function withKnownWatermark(clean: RgbImage): Promise<RgbImage> {
  const text = await sharp(Buffer.from(RULIONLINE.text.pngBase64, "base64")).ensureAlpha().png().toBuffer();
  const logo = Buffer.from(RULIONLINE.logo.pngBase64, "base64");
  const data = await sharp(clean.data, { raw: { width: clean.width, height: clean.height, channels: 3 } })
    .composite([
      { input: text, left: Math.floor(clean.width / 2) + RULIONLINE.text.anchor.dx, top: clean.height + RULIONLINE.text.anchor.dy },
      { input: logo, left: clean.width + RULIONLINE.logo.anchor.dx, top: clean.height + RULIONLINE.logo.anchor.dy },
    ])
    .removeAlpha()
    .raw()
    .toBuffer();
  return { data, width: clean.width, height: clean.height };
}

function changedOutside(a: RgbImage, b: RgbImage, mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < a.width * a.height; i++) {
    if (mask[i]) continue;
    if (a.data[i * 3] !== b.data[i * 3] || a.data[i * 3 + 1] !== b.data[i * 3 + 1] || a.data[i * 3 + 2] !== b.data[i * 3 + 2]) n++;
  }
  return n;
}

describe("rasm ishlovi", () => {
  it("ma'lum watermark (rulionline.uz) shablon bo'yicha topiladi va aniq shaklida tozalanadi", async () => {
    mkdirSync(OUT, { recursive: true });
    const clean = await decodeRgb(await makeImage({ seed: 7, width: 600, height: 400 }));
    const dirty = await withKnownWatermark(clean);
    const hits = await locateKnown(dirty);
    expect(hits.map((h) => h.kind).sort()).toEqual(["logo", "text"]);
    // Watermarksiz rasmda hech narsa topilmaydi va rasm o'zgarmaydi.
    expect(await locateKnown(clean)).toEqual([]);
    const untouched = await cleanWatermarks(clean);
    expect(untouched.regions).toEqual([]);
    expect(untouched.image.data.equals(clean.data)).toBe(true);

    const res = await cleanWatermarks(dirty);
    writeFileSync(join(OUT, "known-0-dirty.png"), await rgbToPng(dirty));
    writeFileSync(join(OUT, "known-1-cleaned.png"), await rgbToPng(res.image));
    expect(res.image.width).toBe(600);
    expect(res.image.height).toBe(400);
    expect(res.changedOutside).toBe(0);
    expect(changedOutside(res.image, dirty, res.mask)).toBe(0);
    // Niqob — to'rtburchak emas: matn qutisining faqat bir qismi (harflar + 2 px).
    const textBox = res.regions.find((r) => r.kind === "text")!;
    let inTextBox = 0;
    for (let y = textBox.y; y < textBox.y + textBox.h; y++) for (let x = textBox.x; x < textBox.x + textBox.w; x++) if (res.mask[y * 600 + x]) inTextBox++;
    expect(inTextBox).toBeLessThan(textBox.w * textBox.h * 0.95);
    // Tozalangan rasm toza rasmga yaqinlashadi.
    const before = meanDiff(dirty, clean, res.mask);
    const after = meanDiff(res.image, clean, res.mask);
    expect(before).toBeGreaterThan(20);
    expect(after).toBeLessThan(before * 0.35);
  });

  it("AI qutisi: quti ichida faqat yozuv piksellari (aniq niqob), qolgani asl", async () => {
    const clean = await toRgb(await makeImage({ seed: 7 }));
    const dirty = await toRgb(await makeImage({ seed: 7, watermark: "center" }));
    const box = { x: 124 / 480, y: 140 / 320, w: 298 / 480, h: 40 / 320 };
    const res = await cleanWatermarks(dirty, { boxes: [box], known: false });
    writeFileSync(join(OUT, "center-1-cleaned.png"), await rgbToPng(res.image));
    expect(res.regions).toHaveLength(1);
    expect(res.regions[0].detail).toBe("precise");
    expect(res.changedOutside).toBe(0);
    expect(changedOutside(res.image, dirty, res.mask)).toBe(0);
    let masked = 0;
    for (const v of res.mask) if (v) masked++;
    expect(masked).toBeLessThan(298 * 40 * 0.8); // butun quti emas
    // Niqob ichida toza rasmga ancha yaqinlashadi (yozuv ostidagi sahna qirralari to'liq tiklanmasligi mumkin).
    expect(meanDiff(res.image, clean, res.mask)).toBeLessThan(meanDiff(dirty, clean, res.mask) * 0.6);
  });

  it("to'liq yopuvchi plashka (pastki tasma) — quti niqobi; crop varianti (≤ 12%)", async () => {
    const bottom = { x: 0, y: (320 - 28) / 320, w: 1, h: 28 / 320 };
    const crop = edgeCrop([bottom])!;
    expect(crop.y).toBe(0);
    expect(crop.h).toBeGreaterThan(0.85);
    expect(crop.h).toBeLessThan(0.92);
    expect(edgeCrop([{ x: 0.3, y: 0.4, w: 0.3, h: 0.1 }])).toBeNull();
    const dirty = await toRgb(await makeImage({ seed: 4, watermark: "bottom" }));
    const cropped = await cropRgb(dirty, crop);
    writeFileSync(join(OUT, "bottom-2-crop.png"), await rgbToPng(cropped));
    expect(cropped.height).toBeLessThan(dirty.height - 25);
    expect(cropped.width).toBe(dirty.width); // kesishdan keyin resize yo'q
    const res = await cleanWatermarks(dirty, { boxes: [bottom], known: false });
    expect(res.changedOutside).toBe(0);
  });

  it("namuna (logotip) template matching bilan topiladi", async () => {
    const dirty = await toRgb(await makeImage({ seed: 9, watermark: "corner" }));
    const tpl = await sharp(dirty.data, { raw: { width: dirty.width, height: dirty.height, channels: 3 } }).extract({ left: 326, top: 284, width: 148, height: 30 }).png().toBuffer();
    const scaled = await sharp(tpl).resize(Math.round(148 * (1000 / dirty.width)), Math.round(30 * (1000 / dirty.width))).png().toBuffer();
    const found = await templateMatch(dirty, scaled);
    expect(found).not.toBeNull();
    expect(found!.x).toBeGreaterThan(0.6);
    expect(found!.y).toBeGreaterThan(0.8);
  });

  it("master va variantlar — lossless WebP, o'lcham o'zgarmaydi, kattalashtirish yo'q", async () => {
    const img = await decodeRgb(await makeImage({ seed: 3, width: 600, height: 400 }));
    const master = await makeMaster(img);
    expect([master.width, master.height]).toEqual([600, 400]);
    const decoded = await sharp(master.data).removeAlpha().raw().toBuffer();
    expect(decoded.equals(img.data)).toBe(true); // piksel-piksel bir xil
    const variants = await makeVariants(master.data);
    expect(variants.map((v) => [v.size, v.width])).toEqual([
      [800, 600],
      [1600, 600],
    ]);
    expect(variants[0].data).toBe(master.data); // qayta encode yo'q
    const big = await makeVariants((await makeMaster(await decodeRgb(await makeImage({ width: 2400, height: 1600 })))).data);
    expect(big.map((v) => v.width)).toEqual([800, 1600]);
    expect((await sharp(big[1].data).metadata()).format).toBe("webp");
    expect(sha256(Buffer.from("a"))).toBe(sha256(Buffer.from("a")));
  });
});
