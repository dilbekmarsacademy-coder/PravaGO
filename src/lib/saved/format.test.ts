import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n";
import { formatAgo, formatBadgeCount, topicBySlug } from "./format";

const NOW = Date.parse("2026-09-28T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("formatAgo", () => {
  const t = dictionaries["uz-latn"].saved.ago;

  it.each([
    [10_000, "hozirgina"],
    [5 * 60_000, "5 daqiqa oldin"],
    [3 * 3_600_000, "3 soat oldin"],
    [2 * 86_400_000, "2 kun oldin"],
    [65 * 86_400_000, "2 oy oldin"],
    [800 * 86_400_000, "2 yil oldin"],
  ])("%i ms → %s", (ms, expected) => {
    expect(formatAgo(ago(ms), NOW, t)).toBe(expected);
  });

  it("kelajakdagi sana (soat farqi) — hozirgina", () => {
    expect(formatAgo(new Date(NOW + 5000).toISOString(), NOW, t)).toBe("hozirgina");
  });

  it("uch tilda ham matn bor", () => {
    for (const dict of Object.values(dictionaries)) {
      expect(formatAgo(ago(2 * 86_400_000), NOW, dict.saved.ago)).toMatch(/2/);
    }
  });
});

describe("topicBySlug", () => {
  it("backend slug'i bo'yicha mavzuni topadi", () => {
    expect(topicBySlug("1-kun-2-mavzu-tartibga-soluvchining-ishoralari")?.number).toBe(15);
    expect(topicBySlug("mavjud-emas")).toBeUndefined();
  });
});

describe("formatBadgeCount", () => {
  it.each([
    [0, "0"],
    [7, "7"],
    [99, "99"],
    [100, "99+"],
    [1000, "99+"],
  ])("%i → %s", (count, expected) => {
    expect(formatBadgeCount(count)).toBe(expected);
  });
});

describe("saqlanganlar matnlari — uch tilda to'liq", () => {
  function leaves(value: unknown, path: string[] = []): [string, unknown][] {
    if (value && typeof value === "object") {
      return Object.entries(value).flatMap(([key, child]) => leaves(child, [...path, key]));
    }
    return [[path.join("."), value]];
  }

  it.each(Object.entries(dictionaries))("%s", (_locale, dict) => {
    for (const [path, value] of leaves(dict.saved)) {
      if (typeof value === "function") {
        expect((value as (...args: number[]) => string)(3, 5), path).toMatch(/\S/);
      } else {
        expect(typeof value, path).toBe("string");
        expect((value as string).trim(), path).not.toBe("");
      }
    }
  });

  it("kirill va rus tarjimalari lotin matnidan farq qiladi", () => {
    const latn = dictionaries["uz-latn"].saved;
    expect(dictionaries["uz-cyrl"].saved.title).not.toBe(latn.title);
    expect(dictionaries.ru.saved.title).not.toBe(latn.title);
    expect(dictionaries.ru.saved.item.locked).not.toBe(latn.item.locked);
  });
});
