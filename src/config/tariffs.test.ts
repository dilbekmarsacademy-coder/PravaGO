import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TARIFFS, onlineTariffId } from "./tariffs";

// Backend alohida paket — import qilinmaydi (frontend build'ida uning node_modules'i yo'q), matni o'qiladi.
const source = readFileSync("backend/src/payments/tariffs.ts", "utf8");
const server = Object.fromEntries(
  [...source.matchAll(/^ {2}(\w+): \{ price: ([\d_]+), durationDays: (\d+|null) \}/gm)].map((m) => [
    m[1],
    { price: Number(m[2].replaceAll("_", "")), durationDays: m[3] === "null" ? null : Number(m[3]) },
  ]),
);

describe("saytdagi tariflar serverdagi (olinadigan) narxlarga teng", () => {
  it("har variant — aynan bitta server tarifi, narx va muddat bir xil", () => {
    const shown = TARIFFS.flatMap((t) => t.options.map((o) => [onlineTariffId(t.id, o.durationDays), { price: o.price, durationDays: o.durationDays }]));
    expect(shown).toHaveLength(5);
    expect(Object.fromEntries(shown)).toEqual(server);
  });
});
