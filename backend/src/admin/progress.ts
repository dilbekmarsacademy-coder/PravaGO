// Foydalanuvchi progressi admin panel uchun: o'tilgan mavzular (eng yaxshi
// natija ≥ PASS_PERCENT) va to'liq o'tilgan kunlar. Faqat kurs mavzulari
// ("dayN-topicM", savoli bor) hisobga olinadi.

import type { PrismaService } from "../prisma/prisma.service";
import { PASS_PERCENT, parseCourseSlug } from "../common/rules";

export interface CourseTopic {
  id: string;
  slug: string;
  day: number;
  order: number;
  title: string;
  titleCyrl: string | null;
  questionCount: number;
}

export async function loadCourseTopics(prisma: PrismaService): Promise<CourseTopic[]> {
  const topics = await prisma.topic.findMany({
    select: { id: true, slug: true, title: true, titleCyrl: true, _count: { select: { questions: { where: { deletedAt: null } } } } },
  });
  return topics
    .flatMap((t) => {
      const parsed = parseCourseSlug(t.slug);
      return parsed && t._count.questions > 0
        ? [{ id: t.id, slug: t.slug, title: t.title, titleCyrl: t.titleCyrl, questionCount: t._count.questions, ...parsed }]
        : [];
    })
    .sort((a, b) => a.day - b.day || a.order - b.order);
}

export interface UserProgress {
  percent: number;
  passedTopics: number;
  totalTopics: number;
  passedDays: number[];
}

/** userId → (topicId → eng yaxshi foiz). */
export async function loadBestPercents(prisma: PrismaService, userIds: string[]): Promise<Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, number>>();
  if (userIds.length === 0) return out;
  const rows = await prisma.topicTestAttempt.groupBy({
    by: ["userId", "topicId"],
    where: { userId: { in: userIds } },
    _max: { percent: true },
  });
  for (const row of rows) {
    const byTopic = out.get(row.userId) ?? new Map<string, number>();
    byTopic.set(row.topicId, row._max.percent ?? 0);
    out.set(row.userId, byTopic);
  }
  return out;
}

export function computeProgress(topics: CourseTopic[], best: Map<string, number> | undefined): UserProgress {
  const passed = new Set(topics.filter((t) => (best?.get(t.id) ?? -1) >= PASS_PERCENT).map((t) => t.id));
  const days = [...new Set(topics.map((t) => t.day))];
  const passedDays = days.filter((day) => topics.filter((t) => t.day === day).every((t) => passed.has(t.id)));
  return {
    percent: topics.length ? Math.round((passed.size / topics.length) * 100) : 0,
    passedTopics: passed.size,
    totalTopics: topics.length,
    passedDays,
  };
}
