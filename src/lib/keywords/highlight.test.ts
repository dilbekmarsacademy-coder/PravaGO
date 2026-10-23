import { describe, expect, it } from "vitest";
import { localizeHighlighted, splitHighlight } from "./highlight";

const text = { cyrl: "Ҳаракатланиш тақиқланади:", uz: "Harakatlanish taqiqlanadi:", ru: "Движение запрещено:" };
const ranges = { cyrl: [13, 24] as [number, number], uz: [14, 25] as [number, number], ru: [9, 18] as [number, number] };

describe("keyword highlight", () => {
  it("picks the range of the text actually shown in each language", () => {
    expect(localizeHighlighted(text, ranges, "uz-cyrl").parts).toEqual({ before: "Ҳаракатланиш ", mark: "тақиқланади", after: ":" });
    expect(localizeHighlighted(text, ranges, "uz-latn").parts?.mark).toBe("taqiqlanadi");
    expect(localizeHighlighted(text, ranges, "ru").parts?.mark).toBe("запрещено");
  });

  it("keeps positions for oʻ/gʻ (formatUzLatin does not change the length)", () => {
    const result = localizeHighlighted({ uz: "Ko'k avtomobilga" }, { uz: [0, 4] }, "uz-latn");
    expect(result.text).toBe("Koʻk avtomobilga");
    expect(result.parts?.mark).toBe("Koʻk");
  });

  it("falls back to the Uzbek Latin range when Russian text is missing", () => {
    expect(localizeHighlighted({ uz: "Harakatlanish taqiqlanadi:" }, ranges, "ru").parts?.mark).toBe("taqiqlanadi");
  });

  it("does not highlight transliterated text (positions would not match)", () => {
    const result = localizeHighlighted({ cyrl: "Кўк автомобилга" }, { cyrl: [0, 3] }, "uz-latn");
    expect(result.text).toBe("Koʻk avtomobilga");
    expect(result.parts).toBeNull();
  });

  it("ignores invalid ranges", () => {
    expect(splitHighlight("abc", [2, 9])).toBeNull();
    expect(splitHighlight("abc", [2, 2])).toBeNull();
    expect(splitHighlight("abc", undefined)).toBeNull();
  });
});
