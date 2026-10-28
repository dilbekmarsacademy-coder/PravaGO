import { describe, expect, it } from "vitest";
import { addRange, chipText, rangesValid, removeRange, suggestRange, suggestRanges, trimRange } from "./keywords";

describe("admin kalit so'z yordamchilari", () => {
  it("oraliqlarni birlashtiradi va tartiblaydi", () => {
    expect(addRange([[10, 15]], [0, 3])).toEqual([[0, 3], [10, 15]]);
    expect(addRange([[0, 5]], [3, 8])).toEqual([[0, 8]]);
    expect(addRange([[0, 5]], [9, 7])).toEqual([[0, 5], [7, 9]]);
    expect(addRange(undefined, [4, 4])).toEqual([]);
    expect(removeRange([[0, 1], [2, 3]], 0)).toEqual([[2, 3]]);
  });

  it("chetdagi bo'sh joylarni qirqadi", () => {
    expect(trimRange("  abc  ", [0, 7])).toEqual([2, 5]);
    expect(trimRange("   ", [0, 3])).toBeNull();
  });

  it("chip matni backend bilan bir xil", () => {
    expect(chipText("Yuk 3 tonna va moped", [[4, 11], [15, 20]])).toBe("3 TONNA + MOPED");
    expect(chipText("abc", undefined)).toBe("");
  });

  it("diapazon tekshiruvi", () => {
    expect(rangesValid("abcdef", [[0, 2], [3, 6]])).toBe(true);
    expect(rangesValid("abc", [[0, 4]])).toBe(false);
    expect(rangesValid("abcdef", [[0, 3], [2, 4]])).toBe(false);
  });

  it("kirill belgilashdan lotin uchun taklif (uzunlik farqi bilan)", () => {
    const cyrl = "Ҳаракатланиш тақиқланади:";
    const latn = "Harakatlanish taqiqlanadi:";
    expect(suggestRange({ text: cyrl, range: [13, 24], lang: "cyrl" }, latn)).toEqual([14, 25]);
    expect(suggestRange({ text: latn, range: [0, 13], lang: "uz" }, cyrl)).toEqual([0, 12]);
  });

  it("bir nechta moslikda nisbiy o'ringa eng yaqinini tanlaydi; topilmasa null", () => {
    const latn = "chap tomondan chap";
    const cyrl = "чап томондан чап";
    expect(suggestRange({ text: latn, range: [14, 18], lang: "uz" }, cyrl)).toEqual([13, 16]);
    expect(suggestRanges(latn, [[0, 4], [5, 13]], "uz", "boshqa matn")).toBeNull();
  });
});
