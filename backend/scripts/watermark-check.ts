// Watermark tozalash sinovi (lokal, bazasiz): papkadagi rasmlarni yangi usul bilan tozalaydi va har biri uchun
//   <nom>-compare.png — Oldin | Keyin | Niqob (yonma-yon);
//   <nom>-zoom.png    — har bir niqob hududi 300% kattalashtirilgan (Oldin / Keyin / niqob chegarasi);
//   <nom>-clean.png   — natija (PNG, lossless, o'lcham o'zgarmagan);
// va report.json / report.md yozadi. Har rasm uchun isbot: niqobdan tashqarida o'zgargan piksellar = 0,
// o'lcham bir xil, niqob ulushi.
//
// Ishlatish: npx ts-node --transpile-only scripts/watermark-check.ts <rasmlar-papkasi> <natija-papkasi> [--boxes boxes.json]
//   boxes.json (ixtiyoriy): { "<fayl nomi>": [{ "x":0.1, "y":0.2, "w":0.1, "h":0.05 }] } — AI qutilarini taqlid qilish.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, extname, join } from "path";
import sharp from "sharp";
import { cleanWatermarks, type NormBox } from "../src/ai-import/watermark/clean";
import { decodeRgb } from "../src/ai-import/image-ops";

async function main() {
  const [dir, out] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!dir || !out) throw new Error("Ishlatish: watermark-check.ts <rasmlar-papkasi> <natija-papkasi> [--boxes boxes.json]");
  const bi = process.argv.indexOf("--boxes");
  const boxesByFile: Record<string, NormBox[]> = bi > 0 ? JSON.parse(readFileSync(process.argv[bi + 1], "utf8")) : {};
  mkdirSync(out, { recursive: true });
  const files = readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
  const rows: Record<string, unknown>[] = [];
  for (const f of files) {
    const original = readFileSync(join(dir, f));
    const meta = await sharp(original).metadata();
    const img = await decodeRgb(original);
    const t0 = Date.now();
    const res = await cleanWatermarks(img, { boxes: boxesByFile[f] ?? [] });
    const ms = Date.now() - t0;
    const name = basename(f, extname(f));
    const raw = (data: Buffer) => sharp(data, { raw: { width: img.width, height: img.height, channels: 3 } });
    const cleanPng = await raw(res.image.data).png().toBuffer();
    writeFileSync(join(out, `${name}-clean.png`), cleanPng);

    // PNG'dan qayta o'qib tekshirish (saqlash yo'qotishsizligini ham isbotlaydi).
    const back = await sharp(cleanPng).raw().toBuffer({ resolveWithObject: true });
    let outsideDiff = 0;
    let insideDiff = 0;
    let maskPx = 0;
    for (let i = 0; i < img.width * img.height; i++) {
      const d = Math.abs(back.data[i * 3] - img.data[i * 3]) + Math.abs(back.data[i * 3 + 1] - img.data[i * 3 + 1]) + Math.abs(back.data[i * 3 + 2] - img.data[i * 3 + 2]);
      if (res.mask[i]) {
        maskPx++;
        insideDiff += d;
      } else if (d) outsideDiff++;
    }

    // Niqob vizualizatsiyasi: o'zgargan joy qizil.
    const vis = Buffer.from(img.data);
    for (let i = 0; i < img.width * img.height; i++) if (res.mask[i]) vis.set([255, 0, 0], i * 3);
    const gap = 6;
    const panel = async (data: Buffer) => raw(data).png().toBuffer();
    await sharp({ create: { width: img.width * 3 + gap * 2, height: img.height, channels: 3, background: "#ffffff" } })
      .composite([
        { input: await panel(img.data), left: 0, top: 0 },
        { input: await panel(res.image.data), left: img.width + gap, top: 0 },
        { input: await panel(vis), left: (img.width + gap) * 2, top: 0 },
      ])
      .png()
      .toFile(join(out, `${name}-compare.png`));

    // 300% zoom har hudud uchun: yuqorida Oldin, o'rtada Keyin, pastda niqob konturi Keyin ustida.
    const zooms: { input: Buffer; left: number; top: number }[] = [];
    let zy = 0;
    let zw = 0;
    for (const r of res.regions) {
      const pad = 12;
      const left = Math.max(0, r.x - pad);
      const top = Math.max(0, r.y - pad);
      const width = Math.min(img.width - left, r.w + pad * 2);
      const height = Math.min(img.height - top, r.h + pad * 2);
      const outline = Buffer.from(res.image.data);
      for (let y = top; y < top + height; y++) {
        for (let x = left; x < left + width; x++) {
          const i = y * img.width + x;
          const edge = res.mask[i] && ((x > 0 && !res.mask[i - 1]) || (x < img.width - 1 && !res.mask[i + 1]) || (y > 0 && !res.mask[i - img.width]) || (y < img.height - 1 && !res.mask[i + img.width]));
          if (edge) outline.set([255, 0, 255], i * 3);
        }
      }
      for (const src of [img.data, res.image.data, outline]) {
        const z = await raw(src).extract({ left, top, width, height }).resize(width * 3, height * 3, { kernel: "nearest" }).png().toBuffer();
        zooms.push({ input: z, left: 0, top: zy });
        zy += height * 3 + 4;
        zw = Math.max(zw, width * 3);
      }
      zy += 12;
    }
    if (zooms.length) await sharp({ create: { width: zw, height: zy, channels: 3, background: "#ffffff" } }).composite(zooms).png().toFile(join(out, `${name}-zoom.png`));

    const row = {
      file: f,
      size: `${meta.width}×${meta.height}`,
      outSize: `${back.info.width}×${back.info.height}`,
      sameSize: back.info.width === meta.width && back.info.height === meta.height,
      regions: res.regions.map((r) => `${r.kind} (${r.detail}) @${r.x},${r.y} ${r.w}×${r.h}, ${r.pixels} px`),
      maskPixels: maskPx,
      maskPercent: +((maskPx / (img.width * img.height)) * 100).toFixed(2),
      changedOutsideMask: outsideDiff,
      changedOutsideEngine: res.changedOutside,
      meanAbsDiffInsideMask: maskPx ? +(insideDiff / (maskPx * 3)).toFixed(2) : 0,
      ms,
    };
    rows.push(row);
    console.log(`${f}: ${row.size} → ${row.outSize}, niqob ${row.maskPercent}%, tashqarida o'zgargan: ${outsideDiff}, ${ms} ms, ${row.regions.join("; ") || "watermark topilmadi"}`);
  }
  writeFileSync(join(out, "report.json"), JSON.stringify(rows, null, 2));
  const md = [
    "| Fayl | O'lcham (oldin → keyin) | Hududlar | Niqob % | Niqobdan tashqarida o'zgargan px | Vaqt |",
    "|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.file} | ${r.size} → ${r.outSize} | ${(r.regions as string[]).join("<br>") || "—"} | ${r.maskPercent} | ${r.changedOutsideMask} | ${r.ms} ms |`),
  ].join("\n");
  writeFileSync(join(out, "report.md"), md + "\n");
  const bad = rows.filter((r) => r.changedOutsideMask !== 0 || !r.sameSize);
  if (bad.length) {
    console.error(`XATO: ${bad.length} ta rasmda niqobdan tashqarida o'zgarish yoki o'lcham farqi bor`);
    process.exit(1);
  }
  console.log(`OK: ${rows.length} ta rasm — niqobdan tashqarida o'zgarish 0, o'lchamlar bir xil.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
