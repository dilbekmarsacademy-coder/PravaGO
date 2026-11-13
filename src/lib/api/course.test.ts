import { describe, expect, it } from "vitest";
import { COURSE_TOPICS, nextCourseTopic } from "@/data/curriculum";
import { withLessonProgress, withReadyCounts, withTestAttempts } from "./course";
import type { Topic } from "@/lib/course-types";

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

describe("withReadyCounts", () => {
  it("savol sonini serverdan oladi, javobli savoli yo'q testni ulamaydi", () => {
    const topics = withReadyCounts(COURSE_TOPICS, { "day4-topic1": 0, "day4-topic2": 60 });
    const t1 = topics.find((t) => t.id === "day4-topic1")!;
    const t2 = topics.find((t) => t.id === "day4-topic2")!;
    expect(t1.testSlug).toBeUndefined();
    expect(t1.lessonId).toBe("day4-topic1");
    expect(t2.questionCount).toBe(60);
    expect(topics.find((t) => t.id === "day1-topic1")).toEqual(COURSE_TOPICS.find((t) => t.id === "day1-topic1"));
  });

  it("server javob bermasa — o'zgarishsiz", () => {
    expect(withReadyCounts(COURSE_TOPICS, null)).toBe(COURSE_TOPICS);
  });
});

describe("withLessonProgress", () => {
  const base = COURSE_TOPICS.find((t) => t.lessonId)!;
  const lesson = { lessonId: base.lessonId!, topicSlug: base.id, durationSec: 100, position: 0, maxPosition: 0, watchedSeconds: 0, watchedPercent: 0, completed: false, everCompleted: true };

  it("faqat videoli mavzu avval ko'rilgan bo'lsa — passedBefore (yakuniy imtihon qulfi qayta yopilmaydi)", () => {
    const videoOnly: Topic = { ...base, testSlug: undefined };
    const [p] = withLessonProgress([], [videoOnly], [lesson]);
    expect(p).toMatchObject({ videoWatched: false, videoPercent: 0, passedBefore: true });
  });

  it("testli mavzuda video avval ko'rilgani testni o'tilgan qilmaydi", () => {
    const withTest: Topic = { ...base, testSlug: base.testSlug ?? base.id };
    const [p] = withLessonProgress([], [withTest], [lesson]);
    expect(p.passedBefore).toBeUndefined();
    expect(p.videoWatched).toBe(false);
  });
});
