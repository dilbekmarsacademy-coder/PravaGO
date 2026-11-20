import { describe, expect, it } from "vitest";
import { needsAnswerConfirm, selectAnswer } from "./answer-confirm";

describe("javobni tasdiqlash paneli", () => {
  it("ro'yxatdagi foydalanuvchi (skipAnswerConfirm=true) — javob darhol qabul qilinadi", () => {
    expect(needsAnswerConfirm(true)).toBe(false);
    expect(selectAnswer(true, 3, "opt-b")).toEqual({ kind: "submit", index: 3, optionId: "opt-b" });
  });

  it("boshqa foydalanuvchi (false) — panel chiqadi", () => {
    expect(needsAnswerConfirm(false)).toBe(true);
    expect(selectAnswer(false, 0, "opt-a")).toEqual({ kind: "confirm", index: 0, optionId: "opt-a" });
  });

  it("bayroq yuklanmagan yoki noma'lum — panel chiqadi (xavfsiz default)", () => {
    expect(selectAnswer(null, 1, "x").kind).toBe("confirm");
    expect(selectAnswer(undefined, 1, "x").kind).toBe("confirm");
    // Server noto'g'ri tur qaytarsa ham faqat aniq `true` o'tkazib yuboradi.
    expect(needsAnswerConfirm("true" as unknown as boolean)).toBe(true);
  });
});
