import { describe, expect, it } from "vitest";
import { formatUzLatin, latinToCyrillic } from "./translit";
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

  it("falls back: cyrl → transliterated uz, ru → uz", () => {
    const text = { uz: "Quvib o'tish" };
    expect(localize(text, "uz-cyrl")).toBe("Қувиб ўтиш");
    expect(localize(text, "ru")).toBe("Quvib oʻtish");
    expect(localize(text, "uz-latn")).toBe("Quvib oʻtish");
  });
});
