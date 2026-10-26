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
    expect(perDay).toEqual([204, 251, 239, 212, 222, 125]);
  });

  it("makes the final exam pool equal to all day 1-6 questions (1253)", () => {
    const pool = sum(COURSE_TOPICS.map((t) => t.questionCount));
    expect(pool).toBe(1253);
    const finalDay = CURRICULUM.find((d) => d.isFinalExam)!;
    expect(finalDay.topics[0].questionCount).toBe(pool);
  });

  it("keeps day 1 topics in the listed order with stable IDs", () => {
    const day1 = COURSE_DAYS.find((d) => d.number === 1)!;
    expect(day1.topicIds).toEqual(Array.from({ length: 7 }, (_, i) => `day1-topic${i + 1}`));
    const titles = CURRICULUM[0].topics.map((t) => t.title.uz);
    expect(titles).toEqual([
      "Svetofor ishoralari",
      "Tartibga soluvchining ishoralari",
      "Chorrahalarda harakatlanish",
      "Tartibga solingan chorrahalar",
      "Tartibga solinmagan chorrahalar: teng ahamiyatli yo'llar",
      "Tartibga solinmagan chorrahalar: asosiy yo'l yo'nalishi o'zgarishi",
      "Tartibga solinmagan chorrahalar: asosiy yo'l yo'nalishi o'zgarishi to'g'risi",
    ]);
  });

  it("keeps day 2 topics in the listed order with stable IDs", () => {
    const day2 = COURSE_DAYS.find((d) => d.number === 2)!;
    expect(day2.topicIds).toEqual(Array.from({ length: 7 }, (_, i) => `day2-topic${i + 1}`));
    expect(CURRICULUM[1].topics.map((t) => t.title.ru)).toEqual([
      "Предупреждающие знаки",
      "Знаки приоритета",
      "Запрещающие знаки",
      "Предписывающие знаки",
      "Информационно-указательные знаки",
      "Знаки сервиса",
      "Знаки дополнительной информации",
    ]);
  });

  it("numbers topics by their position within the day", () => {
    const day1 = COURSE_TOPICS.filter((t) => t.dayId === "day-1");
    expect(day1.map((t) => t.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
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

  it("attaches video lessons to every day 1–6 topic (by topic ID) and test banks to days 1–6", () => {
    expect(COURSE_TOPICS.filter((t) => t.lessonId).map((t) => t.lessonId)).toEqual(
      [[1, 7], [2, 7], [3, 6], [4, 7], [5, 8], [6, 7]].flatMap(([day, count]) =>
        Array.from({ length: count }, (_, i) => `day${day}-topic${i + 1}`),
      ),
    );
    expect(COURSE_TOPICS.filter((t) => t.lessonId).every((t) => t.lessonId === t.id)).toBe(true);
    // Test banki slug'i — mavzu ID'si (backend: day1-topic1 … day6-topic7; 4-kun 1- va 5-mavzu hozircha testsiz).
    expect(COURSE_TOPICS.filter((t) => t.testSlug).map((t) => t.testSlug)).toEqual(
      [
        ...[[1, 7], [2, 7], [3, 6]].flatMap(([day, count]) => Array.from({ length: count }, (_, i) => `day${day}-topic${i + 1}`)),
        ...[2, 3, 4, 6, 7].map((n) => `day4-topic${n}`),
        ...Array.from({ length: 8 }, (_, i) => `day5-topic${i + 1}`),
        ...Array.from({ length: 7 }, (_, i) => `day6-topic${i + 1}`),
      ],
    );
  });

  it("links to the topic page, or straight to the test when there is only a test bank", () => {
    const topic = COURSE_TOPICS.find((t) => t.id === "day1-topic1")!;
    expect(topicHref(topic)).toBe("/kabinet/mavzu/day1-topic1");
    expect(topicHref({ ...topic, lessonId: "day1-topic1", testSlug: "day1-topic1" })).toBe("/kabinet/mavzu/day1-topic1");
    expect(topicHref({ ...topic, lessonId: undefined, testSlug: "day1-topic1" })).toBe("/test/day1-topic1");
  });
});
