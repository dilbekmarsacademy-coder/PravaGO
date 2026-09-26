import { describe, expect, it } from "vitest";
import { cyrillicToLatin, formatUzLatin, latinToCyrillic } from "./translit";
import { localize } from "./localized";
import { CURRICULUM } from "@/data/curriculum";

describe("latinToCyrillic", () => {
  it.each([
    ["o'zbek", "ўзбек"],
    ["g'alaba", "ғалаба"],
    ["shahar", "шаҳар"],
    ["choy", "чой"],
    ["qalam", "қалам"],
    ["xat", "хат"],
    ["yomg'ir", "ёмғир"],
    ["yulduz", "юлдуз"],
    ["yashil", "яшил"],
    ["yer", "ер"],
    ["ertak", "эртак"],
    ["mening", "менинг"],
  ])("%s → %s", (latin, cyrillic) => {
    expect(latinToCyrillic(latin)).toBe(cyrillic);
  });

  it("keeps `ng` as н + г", () => {
    expect(latinToCyrillic("tong")).toBe("тонг");
  });

  it("reads `yo'l` as й + ў, not ё", () => {
    expect(latinToCyrillic("yo'l")).toBe("йўл");
  });

  it("turns `e` into э only at the start of a word", () => {
    expect(latinToCyrillic("ekin yetti")).toBe("экин етти");
    expect(latinToCyrillic("Mexanik")).toBe("Механик");
  });

  it("accepts every apostrophe variant for oʻ and gʻ", () => {
    for (const apostrophe of ["'", "‘", "’", "ʻ", "ʼ"]) {
      expect(latinToCyrillic(`to${apostrophe}g${apostrophe}ri`)).toBe("тўғри");
    }
  });

  it("turns a tutuq apostrophe between letters into ъ", () => {
    expect(latinToCyrillic("ta'minlash")).toBe("таъминлаш");
    expect(latinToCyrillic("ma’lumot")).toBe("маълумот");
  });

  it("uses ц for ts only in Russian loanwords", () => {
    expect(latinToCyrillic("stantsiya")).toBe("станция");
    expect(latinToCyrillic("tsement")).toBe("цемент");
    expect(latinToCyrillic("sotsial")).toBe("социал");
    expect(latinToCyrillic("ketsa")).toBe("кетса");
    expect(latinToCyrillic("o'tsa")).toBe("ўтса");
  });

  it("preserves letter case", () => {
    expect(latinToCyrillic("Shahar")).toBe("Шаҳар");
    expect(latinToCyrillic("O'zbekiston")).toBe("Ўзбекистон");
    expect(latinToCyrillic("YO'L")).toBe("ЙЎЛ");
  });

  it("leaves digits and punctuation untouched", () => {
    expect(latinToCyrillic("7-kun: test, 98%")).toBe("7-кун: тест, 98%");
  });

  it("reproduces the hand-written Cyrillic curriculum titles", () => {
    for (const day of CURRICULUM) {
      for (const topic of day.topics) {
        expect(latinToCyrillic(topic.title.uz), `testNo ${topic.testNo}`).toBe(topic.title.cyrl);
      }
    }
  });
});

describe("cyrillicToLatin", () => {
  const normalizeApostrophes = (text: string) => text.replace(/[ʻʼ‘’]/g, "'");

  it.each([
    ["Ўзбекистон", "Oʻzbekiston"],
    ["ғалаба", "gʻalaba"],
    ["Шаҳар", "Shahar"],
    ["чорраҳа", "chorraha"],
    ["Енгил", "Yengil"],
    ["поезд", "poyezd"],
    ["мопед", "moped"],
    ["ёмғир", "yomgʻir"],
    ["таъминлаш", "taʼminlash"],
    ["компьютер", "kompyuter"],
  ])("%s → %s", (cyrillic, latin) => {
    expect(cyrillicToLatin(cyrillic)).toBe(latin);
  });

  it("keeps all-caps words in caps, including digraphs", () => {
    expect(cyrillicToLatin("ШАҲАР")).toBe("SHAHAR");
    expect(cyrillicToLatin("ЙПХ")).toBe("YPX");
  });

  it("uses s for word-initial ц and ts elsewhere", () => {
    expect(cyrillicToLatin("цемент")).toBe("sement");
    expect(cyrillicToLatin("станция")).toBe("stantsiya");
  });

  it("round-trips the curriculum titles back to their Latin spelling", () => {
    for (const day of CURRICULUM) {
      for (const topic of day.topics) {
        expect(
          normalizeApostrophes(cyrillicToLatin(topic.title.cyrl)),
          `testNo ${topic.testNo}`,
        ).toBe(normalizeApostrophes(topic.title.uz));
      }
    }
  });
});

describe("formatUzLatin", () => {
  it("replaces o'/g' apostrophes with U+02BB", () => {
    expect(formatUzLatin("O'quv dasturi, to‘g’ri")).toBe("Oʻquv dasturi, toʻgʻri");
  });

  it("does not touch the tutuq apostrophe", () => {
    expect(formatUzLatin("ta'minlash")).toBe("ta'minlash");
  });
});

describe("localize", () => {
  it("uses the stored translation when present", () => {
    const text = { uz: "Yuk tashish", cyrl: "Юк ташиш", ru: "Перевозка грузов" };
    expect(localize(text, "uz-latn")).toBe("Yuk tashish");
    expect(localize(text, "uz-cyrl")).toBe("Юк ташиш");
    expect(localize(text, "ru")).toBe("Перевозка грузов");
  });

  it("derives Latin from Cyrillic-only content (question texts)", () => {
    const text = { cyrl: "Қайси транспорт воситасига ҳаракатланиш рухсат этилади?", ru: "Какому транспортному средству разрешено движение?" };
    expect(localize(text, "uz-latn")).toBe("Qaysi transport vositasiga harakatlanish ruxsat etiladi?");
    expect(localize(text, "uz-cyrl")).toBe(text.cyrl);
    expect(localize(text, "ru")).toBe(text.ru);
    expect(localize({ cyrl: "Мотоциклга" }, "ru")).toBe("Mototsiklga");
  });

  it("returns an empty string for empty content", () => {
    expect(localize({}, "uz-latn")).toBe("");
    expect(localize({}, "ru")).toBe("");
  });

  it("falls back: cyrl → transliterated uz, ru → uz", () => {
    const text = { uz: "Quvib o'tish" };
    expect(localize(text, "uz-cyrl")).toBe("Қувиб ўтиш");
    expect(localize(text, "ru")).toBe("Quvib oʻtish");
    expect(localize(text, "uz-latn")).toBe("Quvib oʻtish");
  });
});
