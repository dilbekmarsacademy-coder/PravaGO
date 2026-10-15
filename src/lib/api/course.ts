// Kurs va progress ma'lumotlarini olish uchun API qatlami. Hozircha o'quv
// dasturini (data/curriculum.ts) va mock progressni qaytaradi (tarmoq
// kechikishi simulyatsiya qilinadi) — backend tayyor bo'lgach shu funksiyalar ichini haqiqiy `fetch` so'roviga almashtirish
// kifoya, chaqiruvchi komponentlar o'zgarishsiz qoladi.

import type { Day, ExamProgress, Topic, TopicProgress } from "@/lib/course-types";
import { COURSE_DAYS, COURSE_TOPICS } from "@/data/curriculum";
import { MOCK_EXAM_PROGRESS, MOCK_TOPIC_PROGRESS } from "@/lib/mock/progress";
import { listLessonStatuses, type LessonStatus } from "./lessons";

const NETWORK_DELAY_MS = 700;
// Xato holatini (skeleton → "qayta urinish") tabiiy ravishda sinash imkonini
// beradi; `forceError` bilan ehtiyojga qarab deterministik tarzda ham chaqirish mumkin.
const MOCK_FAILURE_RATE = 0.08;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface DashboardData {
  days: Day[];
  topics: Topic[];
  topicProgress: TopicProgress[];
  examProgress: ExamProgress;
}

export async function getDashboardData(options?: { forceError?: boolean }): Promise<DashboardData> {
  await delay(NETWORK_DELAY_MS);

  if (options?.forceError || Math.random() < MOCK_FAILURE_RATE) {
    throw new Error("Ma'lumotlarni yuklab bo'lmadi");
  }

  // Video progressi haqiqiy backend'dan; u ishlamasa ham kabinet ochiladi
  // (foizlar shunchaki ko'rsatilmaydi).
  const lessons = await listLessonStatuses().catch(() => [] as LessonStatus[]);

  return {
    days: COURSE_DAYS,
    topics: COURSE_TOPICS,
    topicProgress: withLessonProgress(MOCK_TOPIC_PROGRESS, COURSE_TOPICS, lessons),
    examProgress: MOCK_EXAM_PROGRESS,
  };
}

/** Server bergan video holatini mavzu progressiga qo'shadi (`lessonId` bo'yicha). */
export function withLessonProgress(
  progress: TopicProgress[],
  topics: Topic[],
  lessons: LessonStatus[],
): TopicProgress[] {
  const byLesson = new Map(lessons.map((lesson) => [lesson.lessonId, lesson]));
  const byTopic = new Map(progress.map((item) => [item.topicId, item]));
  for (const topic of topics) {
    const lesson = topic.lessonId ? byLesson.get(topic.lessonId) : undefined;
    if (!lesson) continue;
    const base = byTopic.get(topic.id) ?? { topicId: topic.id, videoWatched: false, pdfOpened: false, attempts: [] };
    byTopic.set(topic.id, { ...base, videoWatched: lesson.completed, videoPercent: lesson.watchedPercent });
  }
  return [...byTopic.values()];
}
