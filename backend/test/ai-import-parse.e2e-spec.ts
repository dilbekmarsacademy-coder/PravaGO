import { describe, expect, it } from "vitest";
import { extractFile, unzip } from "../src/ai-import/parse";
import { parseStructure } from "../src/ai-import/parse/structure";
import { plainLine, F_BOLD } from "../src/ai-import/parse/types";
import { containsNormalized, detectScript, findPhraseRange, normalizeForMatch, textSimilarity } from "../src/ai-import/normalize";
import { makeDocx, makeFixtureSet, makePdf, makeZip } from "./helpers/import-fixtures";

describe("normallashtirish va transliteratsiya", () => {
  it("kirill va lotin bir xil ko'rinishga keladi", () => {
    expect(normalizeForMatch("Йўловчилар сони")).toBe(normalizeForMatch("YO'LOVCHILAR SONI"));
    expect(normalizeForMatch("O‘rindiqlar soni!")).toBe(normalizeForMatch("ўриндиқлар сони"));
    expect(normalizeForMatch("oq")).not.toBe(normalizeForMatch("o'q"));
    expect(textSimilarity("Юк автомобили кузовида йўловчилар ташишда", "Yuk avtomobili kuzovida yo'lovchilar tashishda")).toBeGreaterThan(0.95);
    expect(textSimilarity("Quvib o'tish taqiqlanadi", "Temir yo'l kesishmasi")).toBeLessThan(0.4);
    expect(detectScript("Бу белги нимани билдиради?")).toBe("cyrl");
    expect(detectScript("Bu belgi nimani bildiradi?")).toBe("latn");
  });

  it("kalit iborani asl matnda topadi (boshqa yozuvda berilsa ham)", () => {
    const text = "Юк автомобили кузовида йўловчилар ташишда";
    const r = findPhraseRange(text, "YO'LOVCHILAR TASHISHDA")!;
    expect(text.slice(...r)).toBe("йўловчилар ташишда");
    expect(containsNormalized(text, "ЙЎЛОВЧИЛАР")).toBe(true);
    expect(findPhraseRange(text, "svetofor")).toBeNull();
  });
});

describe("docx: savollar, rasmlar va javob belgilari", () => {
  it("(1) to'liq fayl: sarlavha, rasm joylashuvi, qalin javob, 'To'g'ri javob' qatori, hammasi qalin", async () => {
    const { files } = await makeFixtureSet();
    const r = await extractFile(files[0].name, files[0].data);
    const { headings, questions } = r.structure;
    expect(headings[0]).toMatchObject({ day: 2, topicNumber: 1, title: "Огоҳлантирувчи белгилар" });
    expect(questions).toHaveLength(3);
    expect(questions[0]).toMatchObject({ number: 1, text: "Бу белги нимани билдиради?", options: ["Хавфли бурилиш", "Йўл ишлари", "Тор йўл"], correctIndex: 1, correctBy: "bold", day: 2, topicNumber: 1 });
    expect(questions[0].imageRefs).toHaveLength(1);
    // Ikki variant qalin — qalin belgi emas; "To'g'ri javob: F1" qatori hal qiladi.
    expect(questions[1]).toMatchObject({ correctIndex: 0, correctBy: "line" });
    expect(questions[1].imageRefs).toHaveLength(1);
    // Barcha variantlar qalin — javob belgilanmagan.
    expect(questions[2]).toMatchObject({ correctIndex: null, correctBy: null });
    const img = await r.read.readImage(questions[0].imageRefs[0]);
    expect(img?.data.length).toBeGreaterThan(100);
    expect(r.script).toBe("cyrl");
  });

  it("(2) faqat savollar va rasmlar — javob yo'q, lotin", async () => {
    const { files } = await makeFixtureSet();
    const r = await extractFile(files[1].name, files[1].data);
    expect(r.structure.questions.map((q) => [q.number, q.correctIndex, q.imageRefs.length])).toEqual([
      [1, null, 1],
      [2, null, 1],
    ]);
    expect(r.structure.headings[0]).toMatchObject({ day: 3, topicNumber: 2, title: "Yuk tashish" });
    expect(r.script).toBe("latn");
  });

  it("rang va highlight bilan belgilangan javob (docx)", async () => {
    const docx = await makeDocx([
      "1-savol. Rangli javob?",
      "F1 — Bir",
      [{ text: "F2 — Ikki", color: "16A34A" }],
      "2-savol. Highlight javob?",
      [{ text: "F1 — Uch", highlight: "yellow" }],
      "F2 — To'rt",
      "3-savol. Belgi bilan?",
      "F1 — Besh",
      "F2 — Olti ✓",
    ]);
    const r = await extractFile("x.docx", docx);
    expect(r.structure.questions.map((q) => [q.correctIndex, q.correctBy])).toEqual([
      [1, "color"],
      [0, "highlight"],
      [1, "symbol"],
    ]);
    expect(r.structure.questions[2].options[1]).toBe("Olti");
  });
});

describe("boshqa formatlar", () => {
  it("(3) faqat kalit va javoblar: javoblar ro'yxati va kalitlar yozuvi", async () => {
    const { files } = await makeFixtureSet();
    const r = await extractFile(files[2].name, files[2].data);
    expect(r.structure.questions).toHaveLength(0);
    expect(r.structure.answerKeys.map((k) => [k.day, k.topicNumber, k.number, k.optionIndex])).toEqual([
      [3, 2, 1, 1],
      [3, 2, 2, 0],
    ]);
    expect(r.structure.keywords[0]).toMatchObject({ number: 1, questionKey: "ЙЎЛОВЧИЛАР СОНИ", answerKey: "ЎРИНДИҚЛАР СОНИ", day: 3, topicNumber: 2 });
    expect(r.structure.keywords[1]).toMatchObject({ number: 2, questionKey: "ЧИҚИБ ТУРИШИ", answerKey: "1 М, 2 М" });
  });

  it("(4) bir faylda ikki mavzu (html): mavzular ajratiladi, rang/highlight/belgi", async () => {
    const { files } = await makeFixtureSet();
    const r = await extractFile(files[3].name, files[3].data);
    const qs = r.structure.questions;
    expect(r.structure.headings.map((h) => [h.day, h.topicNumber])).toEqual([
      [5, 3],
      [5, 4],
    ]);
    expect(qs.map((q) => [q.topicNumber, q.number, q.correctIndex, q.correctBy])).toEqual([
      [3, 1, 1, "color"],
      [4, 1, 0, "highlight"],
      [4, 2, 0, "symbol"],
    ]);
  });

  it("html kalit kartalari (article.card)", async () => {
    const html = `<html><body><h1>11-mavzu</h1>
      <article class="card" data-num="3"><p class="cue"><strong>QAYSI BELGI</strong></p><h2 class="q">Qaysi belgi <mark class="k-q">bosh yo'l</mark> ekanini bildiradi?</h2>
      <p class="a"><span class="answer-label">To'g'ri javob:</span> <mark class="k-ans">2.1</mark>-belgi</p><p class="chip"><span>BOSH YO'L</span><span class="arrow">→</span><span>2.1</span></p></article>
    </body></html>`;
    const r = await extractFile("kalitlar.html", Buffer.from(html));
    expect(r.structure.keywords).toEqual([expect.objectContaining({ number: 3, questionKey: "QAYSI BELGI", answerKey: "2.1", answerText: "2.1-belgi" })]);
  });

  it("javoblar jadvali fayl oxirida — shu fayldagi savollarga", () => {
    const lines = ["1. Birinchi savol?", "F1 — a", "F2 — b", "2. Ikkinchi savol?", "F1 — c", "F2 — d", "Javoblar", "1 – F2", "2 – F1"].map((t) => plainLine(t));
    const s = parseStructure(lines);
    expect(s.questions.map((q) => [q.correctIndex, q.correctBy])).toEqual([
      [1, "table"],
      [0, "table"],
    ]);
  });

  it("butun matn qalin bo'lsa — qalin belgi hisoblanmaydi", () => {
    const lines = ["1. Savol?", "F1 — a", "F2 — b"].map((t) => plainLine(t, F_BOLD));
    expect(parseStructure(lines).questions[0].correctIndex).toBeNull();
  });

  it("pdf: matn qatorlari va 'Javob:' qatori", async () => {
    const pdf = makePdf(["1-kun 3-mavzu Chorrahalar", "1. Chorrahada kim birinchi o'tadi?", "F1 - Tramvay", "F2 - Avtobus", "Javob: F1"]);
    const r = await extractFile("x.pdf", pdf);
    expect(r.structure.headings[0]).toMatchObject({ day: 1, topicNumber: 3 });
    expect(r.structure.questions[0]).toMatchObject({ number: 1, options: ["Tramvay", "Avtobus"], correctIndex: 0, correctBy: "line" });
  });

  it("zip ichidagi fayllar alohida ochiladi", async () => {
    const { files } = await makeFixtureSet();
    const zip = await makeZip({ "papka/a.docx": files[0].data, "b.txt": files[2].data, "__MACOSX/._a.docx": Buffer.from("x"), "rasm.png": Buffer.from("png") });
    const { files: inner, assets } = await unzip(zip);
    expect(inner.map((f) => f.name).sort()).toEqual(["b.txt", "papka/a.docx"]);
    expect([...assets.keys()]).toEqual(["rasm.png"]);
  });
});
