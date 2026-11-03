import { describe, expect, it } from "vitest";
import { reshuffle } from "./shuffle";

describe("reshuffle", () => {
  it("moves every option to a different position", () => {
    for (const size of [2, 3, 4, 5]) {
      const items = Array.from({ length: size }, (_, i) => `o${i}`);
      for (let run = 0; run < 200; run++) {
        const next = reshuffle(items);
        expect([...next].sort()).toEqual([...items].sort());
        expect(next.every((item, i) => item !== items[i])).toBe(true);
      }
    }
  });

  it("swaps two options", () => {
    expect(reshuffle(["a", "b"])).toEqual(["b", "a"]);
  });

  it("falls back to a rotation when random never yields a derangement", () => {
    expect(reshuffle(["a", "b", "c"], () => 0.999)).toEqual(["b", "c", "a"]);
  });

  it("keeps a single option and does not mutate the input", () => {
    const items = ["a", "b", "c"];
    reshuffle(items);
    expect(items).toEqual(["a", "b", "c"]);
    expect(reshuffle(["a"])).toEqual(["a"]);
  });
});
