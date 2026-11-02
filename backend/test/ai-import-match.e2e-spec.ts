import { describe, expect, it } from "vitest";
import { extractFile } from "../src/ai-import/parse";
import { findDuplicates, findExisting, matchQuestion, optionByText, prepareSite, type RawQuestion } from "../src/ai-import/matching";
import { makeFixtureSet } from "./helpers/import-fixtures";

describe("fayllararo moslashtirish", () => {
  it("lotin savollar (2) + kirill kalitlar va javoblar (3): javob va kalitlar boshqa fayldan", async () => {
    const { files } = await makeFixtureSet();
    const questions = await extractFile(files[1].name, files[1].data);
    const keys = await extractFile(files[2].name, files[2].data);
    const sources = [{ fileId: "f3", fileName: files[2].name, answerKeys: keys.structure.answerKeys, keywords: keys.structure.keywords }];
    const raws: RawQuestion[] = questions.structure.questions.map((q, i) => ({ key: `f2:${i}`, fileId: "f2", fileName: files[1].name, q, day: q.day, topicNumber: q.topicNumber, topicTitle: q.topicTitle, imageIds: [] }));
    const r1 = matchQuestion(raws[0], sources);
    expect(r1).toMatchObject({ correctIndex: 1, matchStatus: "matched", questionKey: "ЙЎЛОВЧИЛАР СОНИ", answerKey: "ЎРИНДИҚЛАР СОНИ", keySource: "file" });
    expect(r1.answerFrom?.fileName).toBe(files[2].name);
    const r2 = matchQuestion(raws[1], sources);
    expect(r2).toMatchObject({ correctIndex: 0, matchStatus: "matched", questionKey: "ЧИҚИБ ТУРИШИ" });
  });

  it("boshqa mavzudagi kalit ishlatilmaydi; o'xshashlik o'rtacha bo'lsa — AI tasdiqlashi uchun nomzod", () => {
    const raw: RawQuestion = {
      key: "a",
      fileId: "a",
      fileName: "a.docx",
      q: { number: 5, text: "Chorrahada tramvay va avtomobil uchrashsa kim birinchi o'tadi?", options: ["Tramvay", "Avtomobil"], correctIndex: null, correctBy: null, imageRefs: [], day: 1, topicNumber: 3, topicTitle: null, questionKey: null, answerKey: null, explanation: null, notes: [] },
      day: 1,
      topicNumber: 3,
      topicTitle: null,
      imageIds: [],
    };
    const other = { fileId: "b", fileName: "b.txt", answerKeys: [{ number: 5, optionIndex: 1, answerText: null, day: 1, topicNumber: 4 }], keywords: [] };
    expect(matchQuestion(raw, [other]).correctIndex).toBeNull();
    const maybe = { fileId: "c", fileName: "c.txt", answerKeys: [], keywords: [{ number: 9, questionText: "Tramvay va avtomobil chorrahada uchrashganda kim oldin o'tadi?", answerText: "Tramvay", questionKey: "KIM", answerKey: "TRAMVAY", day: 1, topicNumber: 3 }] };
    const m = matchQuestion(raw, [maybe]);
    expect(m.candidate?.score).toBeGreaterThanOrEqual(0.6);
    expect(m.correctIndex).toBeNull();
    expect(m.matchStatus).toBe("unmatched");
  });

  it("javob matnini variantga moslash (kirill javob — lotin variant)", () => {
    expect(optionByText(["Ma'muriyatning ko'rsatmasi bilan", "Jihozlangan o'rindiqlarning soni bilan"], "Жиҳозланган ўриндиқларнинг сони билан")).toBe(1);
    expect(optionByText(["Ha", "Yo'q"], "bilmayman")).toBeNull();
  });

  it("dublikat: eng to'liq varianti qoladi; turli javob — ziddiyat", () => {
    const base = { text: "Qaysi belgi asosiy yo'lni bildiradi?", options: ["2.1", "2.4", "5.1"] };
    const clusters = findDuplicates([
      { ...base, correctIndex: 0, hasImage: false, hasKeys: false, fileName: "a.docx" },
      { ...base, text: "Qaysi belgi asosiy yoʻlni bildiradi", correctIndex: 1, hasImage: true, hasKeys: true, fileName: "b.docx" },
      { text: "Boshqa savol umuman", options: ["x", "y"], correctIndex: null, hasImage: false, hasKeys: false, fileName: "c.docx" },
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toEqual([0, 1]);
    expect(clusters[0].primary).toBe(1);
    expect(clusters[0].conflict?.map((c) => c.answer)).toEqual(["2.1", "2.4"]);
  });

  it("saytda allaqachon bor savol aniqlanadi", () => {
    const site = prepareSite([{ id: "q1", topicSlug: "day2-topic1", text: "Бу белги нимани билдиради: йўл ишлари", options: ["Хавфли бурилиш", "Йўл ишлари"] }]);
    expect(findExisting(site, "Bu belgi nimani bildiradi: yo'l ishlari", ["Xavfli burilish", "Yo'l ishlari"])?.questionId).toBe("q1");
    expect(findExisting(site, "Mutlaqo boshqa savol matni bu yerda", ["a", "b"])).toBeNull();
  });
});
