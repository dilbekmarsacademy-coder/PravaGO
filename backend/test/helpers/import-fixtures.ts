// AI import testlari uchun fixture fayllar — testning o'zida yaratiladi (docx, html, txt, pdf, zip, rasmlar).

import JSZip from "jszip";
import sharp from "sharp";

export interface RunSpec {
  text: string;
  bold?: boolean;
  color?: string;
  highlight?: string;
}

export type ParaSpec = string | RunSpec[] | { image: string };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function runXml(r: RunSpec): string {
  const props = [r.bold ? "<w:b/>" : "", r.color ? `<w:color w:val="${r.color}"/>` : "", r.highlight ? `<w:highlight w:val="${r.highlight}"/>` : ""].join("");
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
}

/** Oddiy .docx: paragraflar (matn / formatlangan run'lar / rasm). */
export async function makeDocx(paragraphs: ParaSpec[], images: Record<string, Buffer> = {}): Promise<Buffer> {
  const zip = new JSZip();
  const rels: string[] = [];
  let rid = 1;
  const body = paragraphs
    .map((p) => {
      if (typeof p === "string") return `<w:p>${runXml({ text: p })}</w:p>`;
      if (Array.isArray(p)) return `<w:p>${p.map(runXml).join("")}</w:p>`;
      const id = `rId${rid++}`;
      rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${p.image}"/>`);
      zip.file(`word/media/${p.image}`, images[p.image]);
      return `<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="${id}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    })
    .join("");
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/><Default Extension="xml" ContentType="application/xml"/></Types>`);
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`,
  );
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

/** Sinov rasmi: yo'l sahnasiga o'xshash gradient + shakllar; ixtiyoriy sun'iy watermark (burchakda / o'rtada). */
export async function makeImage(opts: { width?: number; height?: number; seed?: number; watermark?: "corner" | "center" | "bottom" | null } = {}): Promise<Buffer> {
  const width = opts.width ?? 480;
  const height = opts.height ?? 320;
  const seed = opts.seed ?? 1;
  const hue = (seed * 47) % 360;
  const wm =
    opts.watermark === "corner"
      ? `<text x="${width - 150}" y="${height - 16}" font-size="22" font-family="Arial" font-weight="bold" fill="white" fill-opacity="0.85">avtotest.uz</text>`
      : opts.watermark === "center"
        ? `<text x="${width / 2 - 110}" y="${height / 2 + 10}" font-size="34" font-family="Arial" font-weight="bold" fill="white" fill-opacity="0.7">@PRAVA_KANAL</text>`
        : opts.watermark === "bottom"
          ? `<rect x="0" y="${height - 28}" width="${width}" height="28" fill="#1e3a8a"/><text x="12" y="${height - 9}" font-size="16" font-family="Arial" fill="white">t.me/prava_test · reklama</text>`
          : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},55%,70%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},35%,45%)"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect x="0" y="${height * 0.62}" width="${width}" height="${height * 0.38}" fill="#555"/>
    <rect x="${width * 0.45}" y="${height * 0.7}" width="${width * 0.1}" height="8" fill="#fff"/>
    <circle cx="${width * 0.25}" cy="${height * 0.35}" r="${height * 0.14}" fill="#d22" stroke="#fff" stroke-width="6"/>
    <rect x="${width * 0.6}" y="${height * 0.45}" width="${width * 0.22}" height="${height * 0.14}" rx="10" fill="hsl(${(hue + 180) % 360},60%,40%)"/>
    ${wm}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Minimal matnli PDF (bitta sahifa, har qator alohida) — kirill matnsiz (standart shrift). */
export function makePdf(lines: string[]): Buffer {
  const content = ["BT", "/F1 12 Tf", "14 TL", "50 780 Td", ...lines.map((l) => `(${l.replace(/[()\\]/g, "\\$&")}) Tj T*`), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

export async function makeZip(files: Record<string, Buffer>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, data] of Object.entries(files)) zip.file(name, data);
  return zip.generateAsync({ type: "nodebuffer" });
}

/**
 * Kamida 4 faylli to'plam:
 *  (1) savollar + rasmlar + javoblar bitta faylda (kirill docx, qalin javob, "To'g'ri javob" qatori);
 *  (2) faqat savollar va rasmlar (lotin docx, javobsiz);
 *  (3) faqat kalit va javoblar (txt: javoblar jadvali + kalitlar, kirill kalit lotin savolga);
 *  (4) ikki mavzuli fayl (html, rang va highlight bilan belgilangan javob).
 * Rasmlarning bir qismida burchak va o'rtada sun'iy watermark.
 */
export async function makeFixtureSet() {
  const img1 = await makeImage({ seed: 1, watermark: "corner" });
  const img2 = await makeImage({ seed: 2, watermark: "center" });
  const img3 = await makeImage({ seed: 3 });
  const img4 = await makeImage({ seed: 4, watermark: "bottom" });

  const full = await makeDocx(
    [
      "2-kun 1-мавзу Огоҳлантирувчи белгилар",
      "1-савол. Бу белги нимани билдиради?",
      { image: "q1.png" },
      "F1 — Хавфли бурилиш",
      [{ text: "F2 — Йўл ишлари", bold: true }],
      "F3 — Тор йўл",
      "2-савол. Қайси белги олдинда пиёдалар ўтиш жойи борлигини билдиради?",
      { image: "q2.png" },
      [{ text: "F1 — 1.22-белги", bold: true }],
      [{ text: "F2 — 1.20-белги", bold: true }],
      "To'g'ri javob: F1",
      "3-савол. Барча вариантлар қалин бўлган савол?",
      [{ text: "F1 — Биринчи", bold: true }],
      [{ text: "F2 — Иккинчи", bold: true }],
      [{ text: "F3 — Учинчи", bold: true }],
    ],
    { "q1.png": img1, "q2.png": img2 },
  );

  const questionsOnly = await makeDocx(
    [
      "3-kun 2-mavzu Yuk tashish",
      "1-savol. Yuk avtomobili kuzovida yo'lovchilar tashishda ularning soni nima bilan belgilanadi?",
      { image: "a.png" },
      "F1 — Ma'muriyatning ko'rsatmasi bilan",
      "F2 — Jihozlangan o'rindiqlarning soni bilan",
      "F3 — Haydovchining qarori bilan",
      "2-savol. Yuk transport vositasidan chiqib turishi mumkin bo'lgan masofa?",
      { image: "b.png" },
      "F1 — Oldindan 1 m, orqadan 2 m",
      "F2 — Oldindan 2 m, orqadan 1 m",
    ],
    { "a.png": img3, "b.png": img4 },
  );

  const keysOnly = Buffer.from(
    [
      "3-кун 2-мавзу Юк ташиш — калитлар",
      "Жавоблар: 1-F2, 2-F1",
      "1. Юк автомобили кузовида йўловчилар ташишда уларнинг сони нима билан белгиланади?",
      "Савол калити: ЙЎЛОВЧИЛАР СОНИ",
      "Жавоб калити: ЎРИНДИҚЛАР СОНИ",
      "2. Юк транспорт воситасидан чиқиб туриши мумкин бўлган масофа?",
      "Калит сўз: ЧИҚИБ ТУРИШИ → 1 М, 2 М",
    ].join("\n"),
    "utf8",
  );

  const twoTopics = Buffer.from(
    `<html><body>
      <h2>5-kun 3-mavzu Quvib o'tish</h2>
      <p>1-savol. Quvib o'tish qaysi holatda taqiqlanadi?</p>
      <p>F1 — Chorrahada</p>
      <p><span style="color:#16a34a">F2 — Piyodalar o'tish joyida</span></p>
      <p>F3 — Avtomagistralda</p>
      <h2>5-kun 4-mavzu Temir yo'l kesishmalari</h2>
      <p>1-savol. Temir yo'l kesishmasida to'xtash mumkinmi?</p>
      <p><mark>F1 — Yo'q</mark></p>
      <p>F2 — Ha</p>
      <p>2-savol. Shlagbaum yopilayotganda nima qilish kerak?</p>
      <p>F1 — Tezlikni oshirib o'tish ✓</p>
      <p>F2 — To'xtash</p>
    </body></html>`,
    "utf8",
  );

  return {
    files: [
      { name: "2-kun-1-mavzu-toliq.docx", data: full },
      { name: "3-kun-savollar.docx", data: questionsOnly },
      { name: "3-kun-kalitlar.txt", data: keysOnly },
      { name: "5-kun-ikki-mavzu.html", data: twoTopics },
    ],
    images: { img1, img2, img3, img4 },
  };
}
