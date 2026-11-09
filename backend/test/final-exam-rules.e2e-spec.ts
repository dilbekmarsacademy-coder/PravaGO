import { describe, expect, it } from "vitest";
import { initialOrder, isOrderDependentText, isOrderLocked, reshuffle } from "../src/common/option-order";
import { buildFailureNote, buildLetter, chooseTone, letterFacts, templateCount, type LetterTone } from "../src/final-exam/letter";
import { averagePercent, certificateNumber, formatPercent, isPassed, scorePercent } from "../src/final-exam/rules";
import { adjacentRepeats, selectExamQuestions, splitEvenly, type PoolQuestion } from "../src/final-exam/selection";

// Yakuniy imtihon: sof qoidalar (bazasiz).

/** Kurs xaritasidagi (src/data/curriculum.ts) mavzular hajmi — 42 mavzu, 1255 savol. */
const REAL_SIZES: number[][] = [
  [38, 32, 14, 21, 49, 31, 19],
  [37, 19, 63, 31, 62, 1, 38],
  [58, 17, 13, 46, 71, 34],
  [5, 74, 36, 73, 3, 7, 14],
  [52, 45, 35, 18, 15, 9, 28, 20],
  [13, 19, 11, 25, 14, 22, 21],
];
const REAL_POOL: PoolQuestion[] = REAL_SIZES.flatMap((sizes, d) =>
  sizes.flatMap((n, t) => Array.from({ length: n }, (_, i) => ({ id: `d${d + 1}t${t + 1}q${i}`, topicId: `day${d + 1}-topic${t + 1}`, day: d + 1 }))),
);

describe("98% chegarasi va urinishlar", () => {
  it("97,9 o'tmaydi, 98,0 o'tadi; 10 tadan kam urinish — o'tmaydi", () => {
    const below = [...Array(9).fill(98), 97];
    const exact = Array(10).fill(98);
    expect(averagePercent(below)).toBe(97.9);
    expect(isPassed(below)).toBe(false);
    expect(averagePercent(exact)).toBe(98);
    expect(isPassed(exact)).toBe(true);
    expect(isPassed(Array(9).fill(100))).toBe(false);
    expect(isPassed([...Array(9).fill(100), 80])).toBe(true); // 98,0
    expect(isPassed([...Array(9).fill(100), 75])).toBe(false); // 97,5
  });

  it("foiz 1 xona kasr bilan; ko'rinishi 98% / 98,7%", () => {
    expect(scorePercent(19, 20)).toBe(95);
    expect(scorePercent(49, 50)).toBe(98);
    expect(scorePercent(2, 3)).toBe(66.7);
    expect(formatPercent(98)).toBe("98%");
    expect(formatPercent(100)).toBe("100%");
    expect(formatPercent(98.7)).toBe("98,7%");
    expect(certificateNumber(2026, 123)).toBe("PI-2026-000123");
  });
});

describe("Savollarni tanlash", () => {
  it("kunlar bo'yicha teng bo'lish (sig'imdan oshmaydi)", () => {
    expect(splitEvenly([100, 100, 100, 100, 100, 100], 20).sort()).toEqual([3, 3, 3, 3, 4, 4]);
    expect(splitEvenly([1, 100, 100], 20)).toEqual(expect.arrayContaining([1]));
    expect(splitEvenly([1, 100, 100], 20).reduce((s, n) => s + n, 0)).toBe(20);
  });

  for (const count of [20, 50]) {
    it(`${count} talik: 200 marta — takror yo'q, kunlar teng, ketma-ket bir mavzu chiqmaydi`, () => {
      let repeats = 0;
      for (let run = 0; run < 200; run++) {
        const picked = selectExamQuestions(REAL_POOL, new Set(), count);
        expect(picked).toHaveLength(count);
        expect(new Set(picked.map((q) => q.id)).size).toBe(count);
        const perDay = [1, 2, 3, 4, 5, 6].map((d) => picked.filter((q) => q.day === d).length);
        expect(Math.max(...perDay) - Math.min(...perDay)).toBeLessThanOrEqual(1);
        // Kun ichida ham mavzular bo'yicha teng: bir mavzudan ko'pi bilan ceil(kvota / mavzular).
        repeats += adjacentRepeats(picked);
      }
      console.log(`[final-exam] ${count} talik, 200 generatsiya: ketma-ket bir xil mavzu = ${repeats}`);
      expect(repeats).toBe(0);
    });
  }

  it("oldingi urinishlarda chiqmaganlar ustun; yetmasa — takrorga ruxsat", () => {
    const seen = new Set(REAL_POOL.filter((_, i) => i % 2 === 0).map((q) => q.id));
    for (let run = 0; run < 20; run++) {
      expect(selectExamQuestions(REAL_POOL, seen, 50).filter((q) => seen.has(q.id))).toHaveLength(0);
    }
    const small = REAL_POOL.filter((q) => q.topicId.endsWith("topic1"));
    const allSeen = new Set(small.slice(0, small.length - 5).map((q) => q.id));
    const picked = selectExamQuestions(small, allSeen, 20);
    expect(picked).toHaveLength(20);
    // Kun kvotasi (3–4) ichida — 6-kundagi yangi savollar ustun.
    const day6 = picked.filter((q) => q.day === 6);
    expect(day6.length).toBeGreaterThanOrEqual(3);
    expect(day6.every((q) => !allSeen.has(q.id))).toBe(true);
  });

  it("faqat bitta mavzu qolganda — minimal takror (yiqilmaydi)", () => {
    const pool = [...Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, topicId: "A", day: 1 })), { id: "b0", topicId: "B", day: 2 }];
    const picked = selectExamQuestions(pool, new Set(), 11);
    expect(picked).toHaveLength(11);
    expect(adjacentRepeats(picked)).toBe(8);
  });
});

describe("Variantlar tartibi", () => {
  it("tartibga bog'liq variantlar aniqlanadi (uz/kirill/rus, harf va raqam belgilari)", () => {
    const locked = [
      "Hammasi", "Barchasi", "Hammasi to'g'ri", "Barchasi toʻgʻri", "Ҳаммаси тўғри", "Все верны", "Barcha javoblar toʻgʻri", "Yuqoridagilarning barchasi", "Barcha sanab oʻtilgan hollarda", "Sanab o'tilgan barcha hollarda",
      "Hech biri", "Hech qaysi", "1 va 2", "2 ва 3", "1 и 4", "Faqat «А»", "Faqat «Б» va «В»", "Faqat A", "Faqat 1", "A va B to'g'ri", "1 va 2 to'g'ri",
      "Ҳаммаси", "Барча жавоблар тўғри", "Юқоридаги барча ҳолатлар", "Все ответы верны", "Во всех перечисленных случаях", "Все вышеперечисленное",
      "Ни один из ответов", "F1 va F2", "1) Qizil", "Har ikkisi toʻgʻri", "Оба правильно",
    ];
    const free = [
      "Faqat toʻgʻriga", "Barcha yoʻnalishlarga", "Ikkala rasmda", "Hech kimga", "1,6 mm", "2,5 m", "25 m", "3,5 t", "90 km/soat", "3", "Har ikki haydovchi buzadi",
      "Только прямо", "Во всех направлениях", "Barcha transport vositalariga", "Faqat qizil avtomobil haydovchisi",
    ];
    for (const t of locked) expect(isOrderDependentText(t), t).toBe(true);
    for (const t of free) expect(isOrderDependentText(t), t).toBe(false);
    expect(isOrderLocked([{ text: "Қизил" }, { text: "Ҳаммаси", textLatn: "Hammasi" }])).toBe(true);
    expect(isOrderLocked([{ text: "Қизил", textRu: "Красный" }, { text: "Яшил", textRu: "Зелёный" }])).toBe(false);
  });

  it("qulflangan savol — manbadagi tartib; oddiy savol — urinishlar orasida o'zgaradi", () => {
    const ids = ["a", "b", "c", "d"];
    for (let i = 0; i < 50; i++) expect(initialOrder(ids, true)).toEqual(ids);
    const orders = new Set(Array.from({ length: 50 }, () => initialOrder(ids, false).join("")));
    expect(orders.size).toBeGreaterThan(5);
  });

  it("qayta aralashtirish: har bir variant boshqa joyga o'tadi", () => {
    for (let i = 0; i < 100; i++) {
      const next = reshuffle(["a", "b", "c"]);
      expect(next.every((x, j) => x !== ["a", "b", "c"][j])).toBe(true);
    }
  });
});

describe("Motivatsion xat", () => {
  const cases: [LetterTone, number[]][] = [
    ["perfect", [100, 100, 95, 100, 100, 100, 100, 100, 100, 100]],
    ["steady", [100, 95, 100, 95, 100, 100, 95, 100, 95, 100]],
    ["growth", [95, 95, 100, 95, 100, 100, 100, 100, 100, 100]],
    ["learned", [100, 100, 90, 100, 100, 100, 95, 100, 95, 100]],
  ];

  for (const [tone, percents] of cases) {
    it(`${tone}: ohang, raqamlar va hajm (90–140 so'z) — har bir varianti`, () => {
      const facts = letterFacts({ questions: 20, percents });
      expect(chooseTone(facts)).toBe(tone);
      for (let v = 0; v < templateCount(tone); v++) {
        const { text, tone: chosen } = buildLetter({ questions: 20, percents }, Math.random, v);
        expect(chosen).toBe(tone);
        const words = text.split(/\s+/).filter(Boolean).length;
        expect(words, `${tone}#${v}: ${words} so'z`).toBeGreaterThanOrEqual(85);
        expect(words, `${tone}#${v}: ${words} so'z`).toBeLessThanOrEqual(140);
        expect(text).toContain(formatPercent(facts.average));
        expect(text).toMatch(/omad/i);
        expect(text).not.toMatch(/100% o'tasiz|albatta o'tasiz|kafolat/i);
        expect(text).not.toContain("undefined");
        expect(text).not.toContain("NaN");
      }
    });
  }

  it("statistika to'g'ri: o'rtacha, eng yuqori/past, 100% soni", () => {
    const f = letterFacts({ questions: 50, percents: [96, 98, 100, 100, 98, 100, 96, 100, 98, 100] });
    expect(f).toMatchObject({ average: 98.6, best: 100, lowest: 96, perfectCount: 5, attempts: 10 });
    const { text } = buildLetter({ questions: 50, percents: [96, 98, 100, 100, 98, 100, 96, 100, 98, 100] }, Math.random, 0);
    expect(text).toContain("98,6%");
    expect(text).toContain("50");
  });

  it("o'ta olmaganlar: 3 gap, xato qilingan mavzular, yolg'on maqtovsiz", () => {
    const note = buildFailureNote({ questions: 20, percents: [90, 95, 85, 100, 95, 90, 95, 100, 90, 95] }, [{ title: "Quvib o'tish", errorPercent: 30 }]);
    expect(note.split(/(?<=[.!])\s/).length).toBe(3);
    expect(note).toContain("«Quvib o'tish» (30% xato)");
    expect(note).toContain("2 tasida xatosiz");
  });
});
