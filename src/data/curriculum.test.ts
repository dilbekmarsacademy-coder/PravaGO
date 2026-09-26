import { describe, expect, it } from "vitest";
import { COURSE_DAYS, COURSE_TOPICS, CURRICULUM, topicHref } from "./curriculum";

const regularDays = CURRICULUM.filter((d) => !d.isFinalExam);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("curriculum", () => {
  it("has 7 days, with only day 7 marked as the final exam", () => {
    expect(CURRICULUM.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(CURRICULUM.filter((d) => d.isFinalExam).map((d) => d.day)).toEqual([7]);
  });

  it("covers every testNo from 1 to 42 exactly once across days 1-6", () => {
    const testNos = regularDays.flatMap((d) => d.topics.map((t) => t.testNo));
    expect(testNos).toHaveLength(42);
    expect(new Set(testNos).size).toBe(42);
    expect([...testNos].sort((a, b) => a! - b!)).toEqual(Array.from({ length: 42 }, (_, i) => i + 1));
  });

  it("matches the expected question totals per day", () => {
    const perDay = regularDays.map((d) => sum(d.topics.map((t) => t.questionCount)));
    expect(perDay).toEqual([204, 251, 239, 212, 222, 126]);
  });

  it("makes the final exam pool equal to all day 1-6 questions (1254)", () => {
    const pool = sum(COURSE_TOPICS.map((t) => t.questionCount));
    expect(pool).toBe(1254);
    const finalDay = CURRICULUM.find((d) => d.isFinalExam)!;
    expect(finalDay.topics[0].questionCount).toBe(pool);
  });

  it("keeps the in-day topic order as listed, not sorted by testNo", () => {
    const day1 = COURSE_DAYS.find((d) => d.number === 1)!;
    expect(day1.topicIds).toEqual([
      "topic-15", "topic-14", "topic-22", "topic-23", "topic-24", "topic-26", "topic-25",
    ]);
  });

  it("has a title in all three languages for every topic", () => {
    for (const day of CURRICULUM) {
      for (const topic of day.topics) {
        expect(topic.title.uz.trim()).not.toBe("");
        expect(topic.title.cyrl.trim()).not.toBe("");
        expect(topic.title.ru.trim()).not.toBe("");
      }
    }
  });

  it("links topics with a test bank straight to the test page", () => {
    const topic15 = COURSE_TOPICS.find((t) => t.number === 15)!;
    const topic14 = COURSE_TOPICS.find((t) => t.number === 14)!;
    expect(topicHref(topic15)).toBe("/test/1-kun-2-mavzu-tartibga-soluvchining-ishoralari");
    expect(topicHref(topic14)).toBe("/kabinet/mavzu/topic-14");
  });
});
