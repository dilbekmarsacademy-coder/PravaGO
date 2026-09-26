import { describe, expect, it } from "vitest";
import { formatClock, getTimeUrgency } from "./timer";

describe("getTimeUrgency", () => {
  it("uses warning at 30% and critical at 10 s for a 1-minute test", () => {
    expect(getTimeUrgency(60, 60)).toBe("normal");
    expect(getTimeUrgency(19, 60)).toBe("normal");
    expect(getTimeUrgency(18, 60)).toBe("warning");
    expect(getTimeUrgency(11, 60)).toBe("warning");
    expect(getTimeUrgency(10, 60)).toBe("critical");
    expect(getTimeUrgency(0, 60)).toBe("critical");
  });

  it("scales with longer limits", () => {
    const limit = 25 * 60;
    expect(getTimeUrgency(10 * 60, limit)).toBe("normal");
    expect(getTimeUrgency(7 * 60, limit)).toBe("warning");
    expect(getTimeUrgency(2 * 60, limit)).toBe("critical");
  });
});

describe("formatClock", () => {
  it("pads minutes and seconds", () => {
    expect(formatClock(60)).toBe("01 : 00");
    expect(formatClock(9)).toBe("00 : 09");
    expect(formatClock(25 * 60)).toBe("25 : 00");
  });

  it("never shows negative time", () => {
    expect(formatClock(-3)).toBe("00 : 00");
  });
});
