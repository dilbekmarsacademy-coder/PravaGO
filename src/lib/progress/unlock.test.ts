import { describe, expect, it } from "vitest";
import {
  buildCourseState,
  getTopicBestPercent,
  getTopicStage,
  isDayUnlocked,
  isFinalExamUnlocked,
  isTopicComingSoon,
  isTopicCompleted,
  isTopicUnlocked,
} from "./unlock";
import { COURSE_DAYS, COURSE_TOPICS } from "@/data/curriculum";
import { MOCK_EXAM_PROGRESS, MOCK_TOPIC_PROGRESS } from "@/lib/mock/progress";
import type { Day, Topic, TopicProgress } from "@/lib/course-types";
import { PASS_PERCENT } from "@/config/rules";

// Qulf mantig'i video/testi ulangan mavzularda tekshiriladi — haqiqiy dasturda
// kontent hozircha yo'q ("Tez orada"), shuning uchun har bir mavzuga soxta
// test banki ulanadi.
const TOPICS_WITH_CONTENT: Topic[] = COURSE_TOPICS.map((t) => ({ ...t, testSlug: t.id }));

// 1-kunning birinchi 3 ta mavzusi tugatilgan (day1-topic3 — 2 urinishda: 74% dan
// keyin 99%), 4-mavzu (day1-topic4)da video ko'rilgan, PDF hali ochilmagan.
const PARTIAL_PROGRESS: TopicProgress[] = [
  {
    topicId: "day1-topic1",
    videoWatched: true,
    pdfOpened: true,
    attempts: [{ percent: 98, date: "2026-09-15T09:20:00.000Z" }],
  },
  {
    topicId: "day1-topic2",
    videoWatched: true,
    pdfOpened: true,
    attempts: [{ percent: 100, date: "2026-09-15T10:05:00.000Z" }],
  },
  {
    topicId: "day1-topic3",
    videoWatched: true,
    pdfOpened: true,
    attempts: [
      { percent: 74, date: "2026-09-16T08:40:00.000Z" },
      { percent: 99, date: "2026-09-16T09:10:00.000Z" },
    ],
  },
  {
    topicId: "day1-topic4",
    videoWatched: true,
    pdfOpened: false,
    attempts: [],
  },
];

function topic(id: string, dayId: string, number = 1): Topic {
  return { id, number, order: number, title: { uz: id }, dayId, questionCount: 10, testSlug: id };
}

function day(id: string, number: number, topicIds: string[]): Day {
  return { id, number, isFinalExam: false, topicIds };
}

describe("isTopicCompleted", () => {
  it("returns false when there is no progress", () => {
    expect(isTopicCompleted(undefined)).toBe(false);
  });

  it("returns false when no attempt reaches PASS_PERCENT", () => {
    const progress: TopicProgress = { topicId: "t1", videoWatched: true, pdfOpened: true, attempts: [{ percent: 74, date: "2026-01-01" }] };
    expect(isTopicCompleted(progress)).toBe(false);
  });

  it("returns true when at least one attempt reaches PASS_PERCENT", () => {
    const progress: TopicProgress = {
      topicId: "t1",
      videoWatched: true,
      pdfOpened: true,
      attempts: [
        { percent: 74, date: "2026-01-01" },
        { percent: PASS_PERCENT, date: "2026-01-02" },
      ],
    };
    expect(isTopicCompleted(progress)).toBe(true);
  });
});

describe("getTopicBestPercent", () => {
  it("returns null when there are no attempts", () => {
    expect(getTopicBestPercent(undefined)).toBeNull();
  });

  it("returns the highest attempt percent", () => {
    const progress: TopicProgress = {
      topicId: "t1",
      videoWatched: true,
      pdfOpened: true,
      attempts: [
        { percent: 74, date: "2026-01-01" },
        { percent: 99, date: "2026-01-02" },
      ],
    };
    expect(getTopicBestPercent(progress)).toBe(99);
  });
});

describe("getTopicStage", () => {
  it("is 'video' when nothing done yet", () => {
    expect(getTopicStage(undefined)).toBe("video");
  });

  it("is 'pdf' when video watched but pdf not opened", () => {
    const progress: TopicProgress = { topicId: "t1", videoWatched: true, pdfOpened: false, attempts: [] };
    expect(getTopicStage(progress)).toBe("pdf");
  });

  it("is 'test' when video watched and pdf opened", () => {
    const progress: TopicProgress = { topicId: "t1", videoWatched: true, pdfOpened: true, attempts: [] };
    expect(getTopicStage(progress)).toBe("test");
  });
});

describe("isTopicUnlocked", () => {
  const dayTopics = [topic("t1", "d1"), topic("t2", "d1"), topic("t3", "d1")];

  it("keeps the first topic open even when the day itself is locked", () => {
    expect(isTopicUnlocked(dayTopics[0], dayTopics, {}, false)).toBe(true);
  });

  it("opens the next topic of a not-yet-reached day once the earlier topics of that day are passed", () => {
    const progressByTopicId = {
      t1: { topicId: "t1", videoWatched: true, pdfOpened: true, attempts: [{ percent: 100, date: "2026-01-01" }] },
    };
    expect(isTopicUnlocked(dayTopics[1], dayTopics, progressByTopicId, false)).toBe(true);
    expect(isTopicUnlocked(dayTopics[2], dayTopics, progressByTopicId, false)).toBe(false);
  });

  it("counts any attempt at or above PASS_PERCENT, not the average", () => {
    const progressByTopicId = {
      t1: { topicId: "t1", videoWatched: true, pdfOpened: true, attempts: [{ percent: 20, date: "2026-01-01" }, { percent: 40, date: "2026-01-02" }, { percent: PASS_PERCENT, date: "2026-01-03" }] },
    };
    expect(isTopicUnlocked(dayTopics[1], dayTopics, progressByTopicId, false)).toBe(true);
  });

  it("unlocks the first topic of an unlocked day with no progress needed", () => {
    expect(isTopicUnlocked(dayTopics[0], dayTopics, {}, true)).toBe(true);
  });

  it("keeps the second topic locked while the first is incomplete", () => {
    expect(isTopicUnlocked(dayTopics[1], dayTopics, {}, true)).toBe(false);
  });

  it("unlocks the second topic once the first is completed", () => {
    const progressByTopicId = {
      t1: { topicId: "t1", videoWatched: true, pdfOpened: true, attempts: [{ percent: 100, date: "2026-01-01" }] },
    };
    expect(isTopicUnlocked(dayTopics[1], dayTopics, progressByTopicId, true)).toBe(true);
  });
});

describe("isDayUnlocked", () => {
  const days = [day("d1", 1, ["t1"]), day("d2", 2, ["t2"]), day("d3", 3, ["t3"])];
  const topicsByDayId = { d1: [topic("t1", "d1")], d2: [topic("t2", "d2")], d3: [topic("t3", "d3")] };

  it("day 1 is always unlocked", () => {
    expect(isDayUnlocked(days[0], days, topicsByDayId, {})).toBe(true);
  });

  it("day 2 is locked while day 1's topics are incomplete", () => {
    expect(isDayUnlocked(days[1], days, topicsByDayId, {})).toBe(false);
  });

  it("day 2 unlocks once every topic of day 1 is completed", () => {
    const progressByTopicId = {
      t1: { topicId: "t1", videoWatched: true, pdfOpened: true, attempts: [{ percent: 100, date: "2026-01-01" }] },
    };
    expect(isDayUnlocked(days[1], days, topicsByDayId, progressByTopicId)).toBe(true);
  });
});

describe("isFinalExamUnlocked", () => {
  it("is locked when any day 1-6 topic is incomplete", () => {
    expect(isFinalExamUnlocked(COURSE_DAYS, {}, {})).toBe(false);
  });

  it("unlocks once every day 1-6 topic is completed", () => {
    const topicsByDayId: Record<string, Topic[]> = {};
    for (const t of TOPICS_WITH_CONTENT) {
      (topicsByDayId[t.dayId] ??= []).push(t);
    }
    const progressByTopicId = Object.fromEntries(
      COURSE_TOPICS.filter((t) => t.dayId !== "day-7").map((t) => [
        t.id,
        { topicId: t.id, videoWatched: true, pdfOpened: true, attempts: [{ percent: 100, date: "2026-01-01" }] },
      ]),
    );
    expect(isFinalExamUnlocked(COURSE_DAYS, topicsByDayId, progressByTopicId)).toBe(true);
  });
});

describe("buildCourseState (new user)", () => {
  const state = buildCourseState(COURSE_DAYS, TOPICS_WITH_CONTENT, MOCK_TOPIC_PROGRESS, MOCK_EXAM_PROGRESS);

  it("starts with nothing completed and only the first topic of every day open", () => {
    const topics = state.days.flatMap((d) => d.topics);
    expect(topics.some((t) => t.completed)).toBe(false);
    const firstTopics = state.days.filter((d) => d.topics.length > 0).map((d) => d.topics[0].topic.id);
    expect(firstTopics).toContain("day3-topic1");
    expect(topics.filter((t) => t.unlocked).map((t) => t.topic.id)).toEqual(firstTopics);
    // Kunlarning o'zi (2-mavzudan boshlab) hali qulflangan.
    expect(state.days.filter((d) => d.unlocked).map((d) => d.day.number)).toEqual([1]);
    expect(state.continueTarget?.topic.topic.id).toBe("day1-topic1");
  });
});

// Test banki ulanmagan holat (faqat video yoki "Tez orada") — kontentdan qat'i nazar.
const VIDEO_ONLY_TOPICS: Topic[] = COURSE_TOPICS.map((t) => ({ ...t, testSlug: undefined }));

describe("buildCourseState (coming soon topics)", () => {
  const state = buildCourseState(COURSE_DAYS, VIDEO_ONLY_TOPICS, MOCK_TOPIC_PROGRESS, MOCK_EXAM_PROGRESS);
  const day1 = state.days.find((d) => d.day.number === 1)!;

  it("treats topics without video or test as coming soon", () => {
    // 1–6-kunlarda video darslar bor, qolgan kunlarda hali hech narsa yo'q.
    expect(COURSE_TOPICS.filter((t) => !isTopicComingSoon(t)).map((t) => t.dayId)).toEqual([
      ...Array(7).fill("day-1"),
      ...Array(7).fill("day-2"),
      ...Array(6).fill("day-3"),
      ...Array(7).fill("day-4"),
      ...Array(8).fill("day-5"),
      ...Array(7).fill("day-6"),
    ]);
    expect(isTopicComingSoon({ testSlug: "x" })).toBe(false);
    expect(isTopicComingSoon({ lessonId: "x" })).toBe(false);
  });

  it("keeps every coming-soon topic open and none of them completed", () => {
    expect(day1.topics.map((t) => t.unlocked)).toEqual(Array(7).fill(true));
    expect(day1.topics.some((t) => t.completed)).toBe(false);
  });

  it("does not let coming-soon topics block the next topic", () => {
    const topics = [topic("a", "d1"), { ...topic("b", "d1"), testSlug: undefined }, topic("c", "d1")];
    const progress = { a: { topicId: "a", videoWatched: true, pdfOpened: true, attempts: [{ percent: 100, date: "" }] } };
    expect(isTopicUnlocked(topics[2], topics, progress, true)).toBe(true);
    expect(isTopicUnlocked(topics[2], topics, {}, true)).toBe(false);
  });

  it("has no continue target when nothing can be studied yet", () => {
    expect(state.continueTarget).toBeNull();
  });
});

describe("buildCourseState (video-only topics)", () => {
  const video = (topicId: string, percent: number, watched = false): TopicProgress => ({
    topicId,
    videoWatched: watched,
    videoPercent: percent,
    pdfOpened: false,
    attempts: [],
  });

  it("marks a video-only topic done once the server says it was watched", () => {
    const state = buildCourseState(COURSE_DAYS, VIDEO_ONLY_TOPICS, [video("day1-topic1", 100, true), video("day1-topic2", 40)], MOCK_EXAM_PROGRESS);
    const day1 = state.days[0];
    expect(day1.topics.map((t) => t.completed)).toEqual([true, false, false, false, false, false, false]);
    // Faqat video bor mavzular ketma-ketlikni qulflamaydi.
    expect(day1.topics.every((t) => t.unlocked)).toBe(true);
    expect(state.continueTarget?.topic.topic.id).toBe("day1-topic2");
    expect(state.continueTarget?.topic.stage).toBe("video");
  });

  it("skips topics whose video is not available yet when picking the continue target", () => {
    const watched = ["day1-topic1", "day1-topic2", "day1-topic3", "day1-topic4", "day1-topic5", "day1-topic6"].map((id) =>
      video(id, 100, true),
    );
    const state = buildCourseState(COURSE_DAYS, VIDEO_ONLY_TOPICS, watched, MOCK_EXAM_PROGRESS);
    expect(state.continueTarget).toBeNull();
    expect(state.days[0].completed).toBe(false); // 7-mavzu videosi hali yo'q
  });
});

describe("buildCourseState (day 1 test banks)", () => {
  const passed = (topicId: string, percent: number): TopicProgress => ({
    topicId,
    videoWatched: true,
    videoPercent: 100,
    pdfOpened: false,
    attempts: [{ percent, date: "2026-10-23T10:00:00.000Z" }],
  });

  it("opens the next day 1 topic only after the previous test is passed with 98%", () => {
    const fresh = buildCourseState(COURSE_DAYS, COURSE_TOPICS, MOCK_TOPIC_PROGRESS, MOCK_EXAM_PROGRESS);
    expect(fresh.days[0].topics.map((t) => t.unlocked)).toEqual([true, false, false, false, false, false, false]);

    const almost = buildCourseState(COURSE_DAYS, COURSE_TOPICS, [passed("day1-topic1", 97)], MOCK_EXAM_PROGRESS);
    expect(almost.days[0].topics[1].unlocked).toBe(false);

    const done = buildCourseState(COURSE_DAYS, COURSE_TOPICS, [passed("day1-topic1", 98)], MOCK_EXAM_PROGRESS);
    expect(done.days[0].topics.map((t) => t.unlocked).slice(0, 3)).toEqual([true, true, false]);
    expect(done.days[0].topics[0].completed).toBe(true);
  });
});

describe("buildCourseState (partial progress)", () => {
  const state = buildCourseState(COURSE_DAYS, TOPICS_WITH_CONTENT, PARTIAL_PROGRESS, MOCK_EXAM_PROGRESS);
  const day1 = state.days.find((d) => d.day.number === 1)!;
  const day2 = state.days.find((d) => d.day.number === 2)!;

  it("marks the first three topics of day 1 as completed", () => {
    const completed = day1.topics.filter((t) => t.completed).map((t) => t.topic.id);
    expect(completed).toEqual(["day1-topic1", "day1-topic2", "day1-topic3"]);
  });

  it("keeps day 1's best percent for the two-attempt topic at 99", () => {
    const topic22 = day1.topics.find((t) => t.topic.id === "day1-topic3")!;
    expect(topic22.bestPercent).toBe(99);
  });

  it("unlocks but does not complete the 4th topic (video watched, pdf pending)", () => {
    const topic23 = day1.topics.find((t) => t.topic.id === "day1-topic4")!;
    expect(topic23.unlocked).toBe(true);
    expect(topic23.completed).toBe(false);
    expect(topic23.stage).toBe("pdf");
  });

  it("locks the remaining day-1 topics after the unfinished one", () => {
    const remaining = day1.topics.filter((t) => ["day1-topic5", "day1-topic6", "day1-topic7"].includes(t.topic.id));
    expect(remaining.every((t) => !t.unlocked)).toBe(true);
  });

  it("keeps day 2 locked because day 1 is not fully completed", () => {
    expect(day2.unlocked).toBe(false);
  });

  it("points the continue target at day 1 / day1-topic4", () => {
    expect(state.continueTarget?.dayNumber).toBe(1);
    expect(state.continueTarget?.topic.topic.id).toBe("day1-topic4");
  });

  it("keeps the final exam locked", () => {
    expect(state.finalExamUnlocked).toBe(false);
    expect(state.allRegularDaysCompleted).toBe(false);
  });
});

describe("buildCourseState (all days completed)", () => {
  it("unlocks the final exam and clears the continue target", () => {
    const fullProgress: TopicProgress[] = TOPICS_WITH_CONTENT.filter((t) => t.dayId !== "day-7").map((t) => ({
      topicId: t.id,
      videoWatched: true,
      pdfOpened: true,
      attempts: [{ percent: 100, date: "2026-01-01" }],
    }));

    const state = buildCourseState(COURSE_DAYS, TOPICS_WITH_CONTENT, fullProgress, MOCK_EXAM_PROGRESS);

    expect(state.allRegularDaysCompleted).toBe(true);
    expect(state.finalExamUnlocked).toBe(true);
    expect(state.continueTarget).toBeNull();
  });
});

describe("buildCourseState (o'rtadan boshlagan o'quvchi)", () => {
  // 6-kun 1-mavzu: video ko'rilgan, 2-urinishda 100% — 1–5-kunlar o'tilmagan.
  const progress: TopicProgress[] = [
    { topicId: "day6-topic1", videoWatched: true, pdfOpened: false, attempts: [{ percent: 60, date: "2026-10-30T09:00:00Z" }, { percent: 100, date: "2026-10-30T09:20:00Z" }] },
  ];
  const state = buildCourseState(COURSE_DAYS, COURSE_TOPICS, progress, MOCK_EXAM_PROGRESS);
  const day6 = state.days.find((d) => d.day.number === 6)!;

  it("opens day 6 topic 2 after topic 1 is passed, keeps topic 3 locked", () => {
    expect(day6.topics[0].completed).toBe(true);
    expect(day6.topics[1].unlocked).toBe(true);
    expect(day6.topics[2].unlocked).toBe(false);
  });

  it("other days still start only from their first topic", () => {
    const day5 = state.days.find((d) => d.day.number === 5)!;
    expect(day5.topics.filter((t) => t.unlocked).map((t) => t.topic.id)).toEqual(["day5-topic1"]);
  });
});
