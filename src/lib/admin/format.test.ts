import { describe, expect, it } from "vitest";
import { formatClock, formatPhoneInput, normalizeUzPhone, parseBulkPhones, parseDuration, phoneInputDigits } from "./format";

describe("video davomiyligi", () => {
  it("formatlaydi", () => {
    expect(formatClock(478)).toBe("7:58");
    expect(formatClock(59)).toBe("0:59");
    expect(formatClock(3725)).toBe("1:02:05");
  });

  it("o'qiydi", () => {
    expect(parseDuration("7:58")).toBe(478);
    expect(parseDuration(" 1:02:05 ")).toBe(3725);
    expect(parseDuration("478")).toBe(478);
    expect(parseDuration(formatClock(1562))).toBe(1562);
  });

  it("noto'g'ri qiymat — null", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("0:00")).toBeNull();
    expect(parseDuration("7:75")).toBeNull();
    expect(parseDuration("7.5")).toBeNull();
    expect(parseDuration("1:2:3:4")).toBeNull();
  });
});

describe("telefon maydoni", () => {
  it("+998 dan keyingi 9 ta raqamni oladi", () => {
    expect(phoneInputDigits("+998 90 123 45 67")).toBe("901234567");
    expect(phoneInputDigits("+998901234567")).toBe("901234567");
    expect(phoneInputDigits("998901234567")).toBe("901234567");
    expect(phoneInputDigits("901234567")).toBe("901234567");
    expect(phoneInputDigits("+998 90 123 45 67 89")).toBe("901234567");
    expect(phoneInputDigits("+998 ")).toBe("");
    expect(phoneInputDigits("+99")).toBe("99");
    expect(phoneInputDigits("+998 99 8")).toBe("998");
  });

  it("guruhlab ko'rsatadi", () => {
    expect(formatPhoneInput("")).toBe("+998 ");
    expect(formatPhoneInput("90")).toBe("+998 90");
    expect(formatPhoneInput("90123")).toBe("+998 90 123");
    expect(formatPhoneInput("901234567")).toBe("+998 90 123 45 67");
  });
});

describe("ommaviy qo'shish: telefon qatorlari", () => {
  it("to'g'ri formatlarni qabul qiladi", () => {
    for (const raw of ["+998 90 123 45 67", "+998901234567", "998901234567", "901234567", "90 123-45-67", "+998 (90) 123-45-67", "(90) 123 45 67"]) {
      expect(normalizeUzPhone(raw)).toBe("+998901234567");
    }
  });

  it("noto'g'ri raqamlarni rad etadi", () => {
    for (const raw of ["12345", "9012345678", "90123456", "+7 901 234 56 78", "+90 123 45 67 89", "998 90 123 45 6", "90abc1234567", "Ali 901234567", "99890123456789"]) {
      expect(normalizeUzPhone(raw)).toBeNull();
    }
  });

  it("qator raqami, xato va takroriy qatorlarni ajratadi", () => {
    const lines = parseBulkPhones("+998 90 123 45 67\n\n12345\n901234567\n93 111 22 33\n");
    expect(lines).toEqual([
      { line: 1, raw: "+998 90 123 45 67", status: "ok", phone: "+998901234567" },
      { line: 3, raw: "12345", status: "invalid" },
      { line: 4, raw: "901234567", status: "duplicate", phone: "+998901234567", firstLine: 1 },
      { line: 5, raw: "93 111 22 33", status: "ok", phone: "+998931112233" },
    ]);
  });
});
