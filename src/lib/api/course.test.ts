import { describe, expect, it } from "vitest";
import { COURSE_TOPICS, nextCourseTopic } from "@/data/curriculum";
import { withTestAttempts } from "./course";

describe("withTestAttempts", () => {
  it("adds server attempts to the topic with the matching test bank", () => {
    const progress = withTestAttempts(
      [{ topicId: "day1-topic1", videoWatched: true, videoPercent: 100, pdfOpened: false, attempts: [] }],
      COURSE_TOPICS,
      [
        { topicSlug: "day1-topic1", correct: 37, total: 38, percent: 97, createdAt: "2026-10-23T10:00:00.000Z" },
        { topicSlug: "day1-topic1", correct: 38, total: 38, percent: 100, createdAt: "2026-10-23T11:00:00.000Z" },
        { topicSlug: "day1-topic2", correct: 10, total: 32, percent: 31, createdAt: "2026-10-23T12:00:00.000Z" },
        { topicSlug: "unknown-topic", correct: 1, total: 1, percent: 100, createdAt: "2026-10-23T12:00:00.000Z" },
      ],
    );
    const byId = new Map(progress.map((p) => [p.topicId, p]));
    expect(byId.get("day1-topic1")).toMatchObject({ videoWatched: true, attempts: [{ percent: 97 }, { percent: 100 }] });
    expect(byId.get("day1-topic2")?.attempts).toEqual([{ percent: 31, date: "2026-10-23T12:00:00.000Z" }]);
    expect(progress).toHaveLength(2);
  });
});

describe("nextCourseTopic", () => {
  it("kun ichida keyingi mavzu, kun oxirida keyingi kunning 1-mavzusi", () => {
    expect(nextCourseTopic({ id: "day6-topic1" })?.id).toBe("day6-topic2");
    expect(nextCourseTopic({ id: "day5-topic8" })?.id).toBe("day6-topic1");
    expect(nextCourseTopic({ id: "day6-topic7" })).toBeUndefined();
    expect(nextCourseTopic({ id: "yoq" })).toBeUndefined();
  });
});
