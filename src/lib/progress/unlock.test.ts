import { describe, expect, it } from "vitest";
import {
  buildCourseState,
  getTopicBestPercent,
  getTopicStage,
  isDayUnlocked,
  isFinalExamUnlocked,
  isTopicCompleted,
  isTopicUnlocked,
} from "./unlock";
import { COURSE_DAYS, COURSE_TOPICS } from "@/data/curriculum";
import { MOCK_EXAM_PROGRESS, MOCK_TOPIC_PROGRESS } from "@/lib/mock/progress";
import type { Day, Topic, TopicProgress } from "@/lib/course-types";
import { PASS_PERCENT } from "@/config/rules";

// 1-kunning birinchi 3 ta mavzusi tugatilgan (topic-22 — 2 urinishda: 74% dan
// keyin 99%), 4-mavzu (topic-23)da video ko'rilgan, PDF hali ochilmagan.
const PARTIAL_PROGRESS: TopicProgress[] = [
  {
    topicId: "topic-14",
    videoWatched: true,
    pdfOpened: true,
    attempts: [{ percent: 98, date: "2026-09-15T09:20:00.000Z" }],
  },
  {
    topicId: "topic-15",
    videoWatched: true,
    pdfOpened: true,
    attempts: [{ percent: 100, date: "2026-09-15T10:05:00.000Z" }],
  },
  {
    topicId: "topic-22",
    videoWatched: true,
    pdfOpened: true,
    attempts: [
      { percent: 74, date: "2026-09-16T08:40:00.000Z" },
      { percent: 99, date: "2026-09-16T09:10:00.000Z" },
    ],
  },
  {
    topicId: "topic-23",
    videoWatched: true,
    pdfOpened: false,
    attempts: [],
  },
];

function topic(id: string, dayId: string, number = 1): Topic {
  return { id, number, title: { uz: id }, dayId, questionCount: 10 };
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

  it("locks every topic when the day itself is locked", () => {
    expect(isTopicUnlocked(dayTopics[0], dayTopics, {}, false)).toBe(false);
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
    for (const t of COURSE_TOPICS) {
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
  const state = buildCourseState(COURSE_DAYS, COURSE_TOPICS, MOCK_TOPIC_PROGRESS, MOCK_EXAM_PROGRESS);

  it("starts with nothing completed and only the first topic of day 1 open", () => {
    const topics = state.days.flatMap((d) => d.topics);
    expect(topics.some((t) => t.completed)).toBe(false);
    expect(topics.filter((t) => t.unlocked).map((t) => t.topic.id)).toEqual(["topic-14"]);
    expect(state.continueTarget?.topic.topic.id).toBe("topic-14");
  });
});

describe("buildCourseState (partial progress)", () => {
  const state = buildCourseState(COURSE_DAYS, COURSE_TOPICS, PARTIAL_PROGRESS, MOCK_EXAM_PROGRESS);
  const day1 = state.days.find((d) => d.day.number === 1)!;
  const day2 = state.days.find((d) => d.day.number === 2)!;

  it("marks the first three topics of day 1 as completed", () => {
    const completed = day1.topics.filter((t) => t.completed).map((t) => t.topic.id);
    expect(completed).toEqual(["topic-14", "topic-15", "topic-22"]);
  });

  it("keeps day 1's best percent for the two-attempt topic at 99", () => {
    const topic22 = day1.topics.find((t) => t.topic.id === "topic-22")!;
    expect(topic22.bestPercent).toBe(99);
  });

  it("unlocks but does not complete the 4th topic (video watched, pdf pending)", () => {
    const topic23 = day1.topics.find((t) => t.topic.id === "topic-23")!;
    expect(topic23.unlocked).toBe(true);
    expect(topic23.completed).toBe(false);
    expect(topic23.stage).toBe("pdf");
  });

  it("locks the remaining day-1 topics after the unfinished one", () => {
    const remaining = day1.topics.filter((t) => ["topic-24", "topic-25", "topic-26"].includes(t.topic.id));
    expect(remaining.every((t) => !t.unlocked)).toBe(true);
  });

  it("keeps day 2 locked because day 1 is not fully completed", () => {
    expect(day2.unlocked).toBe(false);
  });

  it("points the continue target at day 1 / topic-23", () => {
    expect(state.continueTarget?.dayNumber).toBe(1);
    expect(state.continueTarget?.topic.topic.id).toBe("topic-23");
  });

  it("keeps the final exam locked", () => {
    expect(state.finalExamUnlocked).toBe(false);
    expect(state.allRegularDaysCompleted).toBe(false);
  });
});

describe("buildCourseState (all days completed)", () => {
  it("unlocks the final exam and clears the continue target", () => {
    const fullProgress: TopicProgress[] = COURSE_TOPICS.filter((t) => t.dayId !== "day-7").map((t) => ({
      topicId: t.id,
      videoWatched: true,
      pdfOpened: true,
      attempts: [{ percent: 100, date: "2026-01-01" }],
    }));

    const state = buildCourseState(COURSE_DAYS, COURSE_TOPICS, fullProgress, MOCK_EXAM_PROGRESS);

    expect(state.allRegularDaysCompleted).toBe(true);
    expect(state.finalExamUnlocked).toBe(true);
    expect(state.continueTarget).toBeNull();
  });
});
