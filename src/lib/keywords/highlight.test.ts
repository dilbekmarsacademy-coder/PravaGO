import { describe, expect, it } from "vitest";
import { localizeHighlighted, splitHighlight } from "./highlight";

const text = { cyrl: "Ҳаракатланиш тақиқланади:", uz: "Harakatlanish taqiqlanadi:", ru: "Движение запрещено:" };
const ranges = { cyrl: [13, 24] as [number, number], uz: [14, 25] as [number, number], ru: [9, 18] as [number, number] };

const marked = (segments: { text: string; marked: boolean }[] | null) => segments?.filter((s) => s.marked).map((s) => s.text) ?? null;

describe("keyword highlight", () => {
  it("picks the range of the text actually shown in each language", () => {
    expect(localizeHighlighted(text, ranges, "uz-cyrl").segments).toEqual([
      { text: "Ҳаракатланиш ", marked: false },
      { text: "тақиқланади", marked: true },
      { text: ":", marked: false },
    ]);
    expect(marked(localizeHighlighted(text, ranges, "uz-latn").segments)).toEqual(["taqiqlanadi"]);
    expect(marked(localizeHighlighted(text, ranges, "ru").segments)).toEqual(["запрещено"]);
  });

  it("keeps positions for oʻ/gʻ (formatUzLatin does not change the length)", () => {
    const result = localizeHighlighted({ uz: "Ko'k avtomobilga" }, { uz: [0, 4] }, "uz-latn");
    expect(result.text).toBe("Koʻk avtomobilga");
    expect(marked(result.segments)).toEqual(["Koʻk"]);
  });

  it("falls back to the Uzbek Latin range when Russian text is missing", () => {
    expect(marked(localizeHighlighted({ uz: "Harakatlanish taqiqlanadi:" }, ranges, "ru").segments)).toEqual(["taqiqlanadi"]);
  });

  it("does not highlight transliterated text (positions would not match)", () => {
    const result = localizeHighlighted({ cyrl: "Кўк автомобилга" }, { cyrl: [0, 3] }, "uz-latn");
    expect(result.text).toBe("Koʻk avtomobilga");
    expect(result.segments).toBeNull();
  });

  it("ignores invalid ranges", () => {
    expect(splitHighlight("abc", [2, 9])).toBeNull();
    expect(splitHighlight("abc", [2, 2])).toBeNull();
    expect(splitHighlight("abc", undefined)).toBeNull();
    expect(splitHighlight("abcdef", [[3, 5], [1, 4]])).toBeNull();
  });

  it("marks several parts of a multi-part keyword", () => {
    const result = localizeHighlighted({ uz: "3 tonnadan ortiq yuk avtomobillari va mopedlar" }, { uz: [[0, 10], [38, 46]] }, "uz-latn");
    expect(marked(result.segments)).toEqual(["3 tonnadan", "mopedlar"]);
    expect(result.segments?.map((s) => s.text).join("")).toBe(result.text);
  });
});
