import { describe, expect, it } from "vitest";
import { clampSeek, formatTime, tick } from "./watch";

const start = { maxPosition: 0, pendingSeconds: 0 };

describe("tick", () => {
  it("counts natural playback and advances the furthest point", () => {
    const result = tick(start, 0, 0.25, true);
    expect(result).toEqual({ kind: "ok", tally: { maxPosition: 0.25, pendingSeconds: 0.25 } });
  });

  it("does not count time while not playing", () => {
    expect(tick(start, 0, 0.25, false)).toEqual({ kind: "ok", tally: start });
  });

  it("does not count backward seeks or rewatching as new furthest point", () => {
    const tally = { maxPosition: 100, pendingSeconds: 0 };
    expect(tick(tally, 100, 20, true)).toEqual({ kind: "ok", tally });
    // Qayta ko'rish — ko'rilgan soniya sifatida hisoblanadi, lekin eng uzoq nuqta o'zgarmaydi.
    expect(tick(tally, 20, 20.25, true)).toEqual({ kind: "ok", tally: { maxPosition: 100, pendingSeconds: 0.25 } });
  });

  it("rewinds a jump into the unwatched part", () => {
    const tally = { maxPosition: 30, pendingSeconds: 1 };
    expect(tick(tally, 30, 300, true)).toEqual({ kind: "rewind", to: 30, tally });
  });

  it("ignores a large step inside the watched part (allowed seek)", () => {
    const tally = { maxPosition: 300, pendingSeconds: 0 };
    expect(tick(tally, 10, 200, true)).toEqual({ kind: "ok", tally });
  });
});

describe("clampSeek", () => {
  it("allows seeking only up to the furthest watched point", () => {
    expect(clampSeek(500, 120, 1500)).toBe(120);
    expect(clampSeek(60, 120, 1500)).toBe(60);
    expect(clampSeek(-5, 120, 1500)).toBe(0);
  });
});

describe("formatTime", () => {
  it("formats minutes and hours", () => {
    expect(formatTime(75)).toBe("1:15");
    expect(formatTime(3725)).toBe("1:02:05");
    expect(formatTime(Number.NaN)).toBe("0:00");
  });
});
