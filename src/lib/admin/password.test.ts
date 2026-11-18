import { describe, expect, it } from "vitest";
import { passwordError, randomPassword } from "./password";

describe("admin parol qoidalari", () => {
  it("tasodifiy parol: 8 belgi, o'xshash belgilarsiz, har safar boshqa", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = randomPassword();
      expect(p).toMatch(/^[a-km-np-z2-9]{8}$/);
      expect(p).not.toMatch(/[0O1lIio]/);
      seen.add(p);
    }
    expect(seen.size).toBeGreaterThan(190);
  });

  it("validatsiya: bo'sh, qisqa, probelli va mos kelmagan parol", () => {
    expect(passwordError("", "")).toBe("Parolni kiriting");
    expect(passwordError("12345", "12345")).toMatch(/Kamida 6/);
    expect(passwordError("bor probel", "bor probel")).toMatch(/bo'sh joy/);
    expect(passwordError("yaxshi-parol", "yaxshi-paro")).toBe("Parollar mos emas");
    expect(passwordError("yaxshi-parol", "yaxshi-parol")).toBeNull();
    expect(passwordError("a".repeat(101), "a".repeat(101))).toMatch(/Ko'pi bilan/);
  });
});
