import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { boxMask, cropRgb, edgeCrop, inpaintBest, makeMaster, makeVariants, meanDiff, rgbToPng, sha256, templateMatch, toRgb } from "../src/ai-import/image-ops";
import { makeImage } from "./helpers/import-fixtures";

// Watermark tozalash haqiqiy rasm ustida: toza rasm + sun'iy watermark → inpaint/crop → toza rasmga yaqinlashishi.
// Natijalar ko'rib chiqish uchun test/output/watermark/ ga yoziladi.
const OUT = join(process.cwd(), "test", "output", "watermark");

describe("rasm ishlovi", () => {
  it("niqob dilate bilan kengayadi", () => {
    const m = boxMask(100, 100, [{ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }], 3);
    expect(m[50 * 100 + 50]).toBe(255);
    expect(m[38 * 100 + 50]).toBe(255); // 40 − 3 px
    expect(m[30 * 100 + 50]).toBe(0);
  });

  it("burchak va o'rtadagi watermark inpaint bilan tozalanadi (toza rasmga yaqinlashadi)", async () => {
    mkdirSync(OUT, { recursive: true });
    for (const [kind, box] of [
      ["corner", { x: (480 - 156) / 480, y: (320 - 40) / 320, w: 150 / 480, h: 32 / 320 }],
      ["center", { x: 124 / 480, y: 140 / 320, w: 298 / 480, h: 40 / 320 }],
    ] as const) {
      const clean = await toRgb(await makeImage({ seed: 7 }));
      const dirty = await toRgb(await makeImage({ seed: 7, watermark: kind }));
      const mask = boxMask(dirty.width, dirty.height, [box]);
      const before = meanDiff(dirty, clean, mask);
      const result = await inpaintBest(dirty, [box]);
      const after = meanDiff(result.image, clean, mask);
      writeFileSync(join(OUT, `${kind}-0-dirty.png`), await rgbToPng(dirty));
      writeFileSync(join(OUT, `${kind}-1-cleaned-${result.method}.png`), await rgbToPng(result.image));
      expect(before).toBeGreaterThan(5);
      // Watermark (oq yozuv) piksellari deyarli qolmaydi.
      const white = (img: { data: Buffer }) => {
        let n = 0;
        for (let i = 0; i < mask.length; i++) if (mask[i] && img.data[i * 3] > 225 && img.data[i * 3 + 1] > 225 && img.data[i * 3 + 2] > 225) n++;
        return n;
      };
      expect(white(result.image)).toBeLessThan(white(dirty) * 0.3);
      // Burchakda (oddiy fon) — toza rasmga yaqin; o'rtada watermark ostidagi shakllar to'liq tiklanmaydi
      // (bunday rasm AI qayta tekshiruvida "qo'lda tekshirish kerak" bo'ladi), lekin farq kamayadi.
      expect(after).toBeLessThan(kind === "corner" ? before * 0.6 : before);
      // Niqobdan tashqari rasm o'zgarmaydi.
      const outside = mask.map((v) => (v ? 0 : 255));
      expect(meanDiff(result.image, dirty, outside)).toBeLessThan(0.5);
    }
  });

  it("chetdagi watermark — crop varianti (≤ 12%), o'rtadagi uchun crop yo'q", async () => {
    const bottom = { x: 0, y: (320 - 28) / 320, w: 1, h: 28 / 320 };
    const crop = edgeCrop([bottom])!;
    expect(crop.y).toBe(0);
    expect(crop.h).toBeGreaterThan(0.85);
    expect(crop.h).toBeLessThan(0.92);
    expect(edgeCrop([{ x: 0.3, y: 0.4, w: 0.3, h: 0.1 }])).toBeNull();
    const dirty = await toRgb(await makeImage({ seed: 4, watermark: "bottom" }));
    const cropped = await cropRgb(dirty, crop);
    writeFileSync(join(OUT, "bottom-0-dirty.png"), await rgbToPng(dirty));
    writeFileSync(join(OUT, "bottom-2-crop.png"), await rgbToPng(cropped));
    expect(cropped.height).toBeLessThan(dirty.height - 25);
  });

  it("namuna (logotip) template matching bilan topiladi", async () => {
    const dirty = await toRgb(await makeImage({ seed: 9, watermark: "corner" }));
    // Namuna — o'sha watermark joyidan kesilgan bo'lak.
    const tpl = await sharp(dirty.data, { raw: { width: dirty.width, height: dirty.height, channels: 3 } }).extract({ left: 326, top: 284, width: 148, height: 30 }).png().toBuffer();
    const scaled = await sharp(tpl).resize(Math.round(148 * (1000 / dirty.width)), Math.round(30 * (1000 / dirty.width))).png().toBuffer();
    const found = await templateMatch(dirty, scaled);
    expect(found).not.toBeNull();
    expect(found!.x).toBeGreaterThan(0.6);
    expect(found!.y).toBeGreaterThan(0.8);
  });

  it("master (Lanczos, ≤ 2×) va WebP variantlar 800/1600; hash", async () => {
    const img = await toRgb(await makeImage({ seed: 3, width: 600, height: 400 }));
    const master = await makeMaster(img);
    expect(master.width).toBe(1200);
    const variants = await makeVariants(master.data);
    expect(variants.map((v) => [v.size, v.width])).toEqual([
      [800, 800],
      [1600, 1200],
    ]);
    expect((await sharp(variants[0].data).metadata()).format).toBe("webp");
    const big = await makeMaster(await toRgb(await makeImage({ width: 2400, height: 1600 }), 4000));
    expect(big.width).toBe(3840);
    expect(sha256(Buffer.from("a"))).toBe(sha256(Buffer.from("a")));
  });
});
