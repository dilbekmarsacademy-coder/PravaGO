import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AdminUser } from "../admin/admin-request";
import { AuditService } from "../admin/audit.service";
import { userSearch } from "../payments/payments.service";
import { PrismaService } from "../prisma/prisma.service";
import { LESSONS, lessonTopicSlug } from "../lessons/lessons.config";
import { lastResetBoundary, nextResetAt } from "./schedule";

// Admin: natijalar arxivi (faqat o'qish). Foydalanuvchi API'lari bu yerga
// murojaat qilmaydi — arxiv faqat /admin/... orqali.

/** Joriy (hali arxivlanmagan) natijalar uchun maxsus kalit. */
export const CURRENT = "current";

export interface WeekSummary {
  weekKey: string;
  /** Hafta oralig'i: oldingi yangilanishdan shu yangilanishgacha. */
  from: Date | null;
  to: Date | null;
  topicTests: number;
  randomTests: number;
  tests: number;
  averagePercent: number | null;
  correct: number;
  wrong: number;
  /** Shu haftada oxirigacha ko'rilgan videolar soni. */
  videosWatched: number;
  /** Video progressi bo'lgan darslar (qisman ko'rilganlar ham). */
  videoLessons: number;
  /** "Tanishib chiqdim" bosilgan mavzular. */
  keywordsViewed: number;
  /** Kalit so'zlar bo'yicha biror harakat bo'lgan mavzular. */
  keywordTopics: number;
}

interface ProgressAggRow {
  weekKey: string;
  videos: bigint;
  videoLessons: bigint;
  keywords: bigint;
  keywordTopics: bigint;
}

interface AggRow {
  weekKey: string;
  tests: bigint;
  topic: bigint;
  random: bigint;
  avg: number | null;
  correct: bigint | null;
  total: bigint | null;
}

const round1 = (n: number | null) => (n === null ? null : Math.round(Number(n) * 10) / 10);

@Injectable()
export class WeeklyArchiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Bajarilgan yangilanishlar (eskidan yangiga) — hafta oraliqlari uchun.
   * Umumiy yangilanishlar + (foydalanuvchi sahifasida) faqat shu foydalanuvchining alohida nollanishlari.
   */
  private async doneResets(userId?: string) {
    return this.prisma.weeklyReset.findMany({
      where: { status: "done", OR: [{ userId: null }, ...(userId ? [{ userId }] : [])] },
      orderBy: { startedAt: "asc" },
      select: { weekKey: true, startedAt: true, finishedAt: true },
    });
  }

  private ranges(resets: { weekKey: string; startedAt: Date }[]) {
    const map = new Map<string, { from: Date | null; to: Date }>();
    resets.forEach((r, i) => map.set(r.weekKey, { from: resets[i - 1]?.startedAt ?? null, to: r.startedAt }));
    return map;
  }

  private summary(row: AggRow, range: { from: Date | null; to: Date | null }, progress?: ProgressAggRow): WeekSummary {
    const correct = Number(row.correct ?? 0);
    return {
      videosWatched: Number(progress?.videos ?? 0),
      videoLessons: Number(progress?.videoLessons ?? 0),
      keywordsViewed: Number(progress?.keywords ?? 0),
      keywordTopics: Number(progress?.keywordTopics ?? 0),
      weekKey: row.weekKey,
      from: range.from,
      to: range.to,
      topicTests: Number(row.topic),
      randomTests: Number(row.random),
      tests: Number(row.tests),
      averagePercent: round1(row.avg),
      correct,
      wrong: Number(row.total ?? 0) - correct,
    };
  }

  /** Joriy natijalar (arxivlanmagan, tugallangan) — SQL. `userId` bo'lmasa — hammasi foydalanuvchi bo'yicha. */
  private currentRowsSql(userId?: string): Prisma.Sql {
    const byUser = userId ? Prisma.sql`AND "userId" = ${userId}` : Prisma.empty;
    return Prisma.sql`
      SELECT "userId", 'topic_test' AS kind, "percent"::numeric AS percent, "correct", "total" FROM "TopicTestAttempt" WHERE "archivedAt" IS NULL ${byUser}
      UNION ALL
      SELECT "userId", 'random_test', "percent"::numeric, "correct", "total" FROM "RandomTestAttempt" WHERE "archivedAt" IS NULL AND "status" <> 'in_progress' ${byUser}`;
  }

  // ── Foydalanuvchi sahifasi ──

  async userWeeks(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, weeklyResetExempt: true, topicFlowGatingEnabled: true } });
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");
    const [resets, archived, current, archivedProgress, currentProgress] = await Promise.all([
      this.doneResets(userId),
      this.prisma.$queryRaw<AggRow[]>`
        SELECT "weekKey", COUNT(*) AS tests,
          COUNT(*) FILTER (WHERE kind = 'topic_test') AS topic, COUNT(*) FILTER (WHERE kind = 'random_test') AS random,
          AVG((data->>'percent')::numeric) AS avg, SUM((data->>'correct')::int) AS correct, SUM((data->>'total')::int) AS total
        FROM "WeeklyResultArchive" WHERE "userId" = ${userId} AND kind IN ('topic_test', 'random_test')
        GROUP BY 1`,
      this.prisma.$queryRaw<AggRow[]>`
        SELECT ${CURRENT}::text AS "weekKey", COUNT(*) AS tests,
          COUNT(*) FILTER (WHERE kind = 'topic_test') AS topic, COUNT(*) FILTER (WHERE kind = 'random_test') AS random,
          AVG(percent) AS avg, SUM("correct") AS correct, SUM("total") AS total
        FROM (${this.currentRowsSql(userId)}) x`,
      // Video va kalit so'zlar progressi (arxivlangan haftalar).
      this.prisma.$queryRaw<ProgressAggRow[]>`
        SELECT "weekKey",
          COUNT(*) FILTER (WHERE kind = 'video_progress' AND data->>'completedAt' IS NOT NULL) AS videos,
          COUNT(*) FILTER (WHERE kind = 'video_progress') AS "videoLessons",
          COUNT(*) FILTER (WHERE kind = 'keywords_progress' AND data->>'viewedAt' IS NOT NULL) AS keywords,
          COUNT(*) FILTER (WHERE kind = 'keywords_progress') AS "keywordTopics"
        FROM "WeeklyResultArchive" WHERE "userId" = ${userId} AND kind IN ('video_progress', 'keywords_progress')
        GROUP BY 1`,
      // Joriy (hali nollanmagan) progress.
      this.prisma.$queryRaw<ProgressAggRow[]>`
        SELECT ${CURRENT}::text AS "weekKey",
          (SELECT COUNT(*) FROM "LessonProgress" WHERE "userId" = ${userId} AND "completedAt" IS NOT NULL) AS videos,
          (SELECT COUNT(*) FROM "LessonProgress" WHERE "userId" = ${userId} AND ("maxPosition" > 0 OR "completedAt" IS NOT NULL)) AS "videoLessons",
          (SELECT COUNT(*) FROM "TopicKeywordsView" WHERE "userId" = ${userId}) AS keywords,
          (SELECT COUNT(*) FROM (
            SELECT q."topicId" FROM "KeywordReview" k JOIN "Question" q ON q."id" = k."questionId" WHERE k."userId" = ${userId}
            UNION SELECT "topicId" FROM "TopicKeywordsView" WHERE "userId" = ${userId}) t) AS "keywordTopics"`,
    ]);
    const ranges = this.ranges(resets);
    const lastReset = resets.at(-1)?.startedAt ?? null;
    const empty = (weekKey: string): AggRow => ({ weekKey, tests: 0n, topic: 0n, random: 0n, avg: null, correct: 0n, total: 0n });
    const testsByWeek = new Map(archived.map((r) => [r.weekKey, r]));
    const progressByWeek = new Map(archivedProgress.map((r) => [r.weekKey, r]));
    const weekKeys = [...new Set([...testsByWeek.keys(), ...progressByWeek.keys()])];
    const weeks = weekKeys
      .map((key) => this.summary(testsByWeek.get(key) ?? empty(key), ranges.get(key) ?? { from: null, to: null }, progressByWeek.get(key)))
      .sort((a, b) => (b.to?.getTime() ?? 0) - (a.to?.getTime() ?? 0));
    return {
      exempt: user.weeklyResetExempt,
      topicFlowGatingEnabled: user.topicFlowGatingEnabled,
      current: this.summary(current[0] ?? empty(CURRENT), { from: lastReset, to: null }, currentProgress[0]),
      weeks,
    };
  }

  /** Darslar: lessonId → { mavzu slug'i, davomiylik }, mavzu nomlari bilan. */
  private async lessonInfo(lessonIds: string[]) {
    const slugs = [...new Set(lessonIds.map((id) => lessonTopicSlug(id)))];
    const topics = slugs.length ? await this.prisma.topic.findMany({ where: { slug: { in: slugs } }, select: { slug: true, title: true } }) : [];
    const titles = new Map(topics.map((t) => [t.slug, t.title]));
    return (lessonId: string) => {
      const topicSlug = lessonTopicSlug(lessonId);
      return { topicSlug, topicTitle: titles.get(topicSlug) ?? topicSlug, durationSec: LESSONS[lessonId]?.durationSec ?? null };
    };
  }

  private videoItem(
    info: (lessonId: string) => { topicSlug: string; topicTitle: string; durationSec: number | null },
    row: { lessonId: string; maxPosition: number; watchedSeconds: number; completedAt: Date | string | null },
  ) {
    const meta = info(row.lessonId);
    const completed = row.completedAt !== null;
    const percent = completed ? 100 : meta.durationSec ? Math.min(99, Math.floor((row.maxPosition / meta.durationSec) * 100)) : 0;
    return { lessonId: row.lessonId, topicSlug: meta.topicSlug, topicTitle: meta.topicTitle, watchedPercent: percent, completed, completedAt: row.completedAt };
  }

  /** Video va kalit so'zlar progressi (hafta yoki "current"). */
  private async progressDetail(userId: string, weekKey: string) {
    if (weekKey === CURRENT) {
      const [videos, reviews, views] = await Promise.all([
        this.prisma.lessonProgress.findMany({
          where: { userId, OR: [{ maxPosition: { gt: 0 } }, { completedAt: { not: null } }] },
          select: { lessonId: true, maxPosition: true, watchedSeconds: true, completedAt: true },
          orderBy: { lessonId: "asc" },
        }),
        this.prisma.$queryRaw<{ topicId: string; reviewed: number }[]>`
          SELECT q."topicId", COUNT(*)::int AS reviewed FROM "KeywordReview" k JOIN "Question" q ON q."id" = k."questionId"
          WHERE k."userId" = ${userId} GROUP BY 1`,
        this.prisma.topicKeywordsView.findMany({ where: { userId }, select: { topicId: true, viewedAt: true } }),
      ]);
      const info = await this.lessonInfo(videos.map((v) => v.lessonId));
      const topicIds = [...new Set([...reviews.map((r) => r.topicId), ...views.map((v) => v.topicId)])];
      const topics = topicIds.length ? await this.prisma.topic.findMany({ where: { id: { in: topicIds } }, select: { id: true, slug: true, title: true } }) : [];
      const reviewedBy = new Map(reviews.map((r) => [r.topicId, r.reviewed]));
      const viewedBy = new Map(views.map((v) => [v.topicId, v.viewedAt]));
      return {
        videoProgress: videos.map((v) => this.videoItem(info, v)),
        keywordsProgress: topics
          .map((t) => ({ topicSlug: t.slug, topicTitle: t.title, reviewedQuestions: reviewedBy.get(t.id) ?? 0, viewedAt: viewedBy.get(t.id) ?? null }))
          .sort((a, b) => a.topicSlug.localeCompare(b.topicSlug, undefined, { numeric: true })),
      };
    }
    const rows = await this.prisma.weeklyResultArchive.findMany({
      where: { userId, weekKey, kind: { in: ["video_progress", "keywords_progress"] } },
      select: { kind: true, data: true },
    });
    type VideoData = { lessonId: string; maxPosition: number; watchedSeconds: number; completedAt: string | null };
    type KeywordsData = { topicSlug: string; topicTitle: string; reviewedQuestions: number; viewedAt: string | null };
    const videoRows = rows.filter((r) => r.kind === "video_progress").map((r) => r.data as unknown as VideoData);
    const info = await this.lessonInfo(videoRows.map((v) => v.lessonId));
    return {
      videoProgress: videoRows.map((v) => this.videoItem(info, v)).sort((a, b) => a.topicSlug.localeCompare(b.topicSlug, undefined, { numeric: true })),
      keywordsProgress: rows
        .filter((r) => r.kind === "keywords_progress")
        .map((r) => {
          const d = r.data as unknown as KeywordsData;
          return { topicSlug: d.topicSlug, topicTitle: d.topicTitle, reviewedQuestions: d.reviewedQuestions, viewedAt: d.viewedAt };
        })
        .sort((a, b) => a.topicSlug.localeCompare(b.topicSlug, undefined, { numeric: true })),
    };
  }

  /** Bitta hafta (yoki "current") batafsil: mavzu testlari, random testlar, video va kalit so'zlar progressi. */
  async userWeekDetail(userId: string, weekKey: string) {
    const progress = await this.progressDetail(userId, weekKey);
    if (weekKey === CURRENT) {
      const [topic, random] = await Promise.all([
        this.prisma.topicTestAttempt.findMany({
          where: { userId, archivedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true, correct: true, total: true, percent: true, createdAt: true, topic: { select: { slug: true, title: true } } },
        }),
        this.prisma.randomTestAttempt.findMany({
          where: { userId, archivedAt: null, status: { not: "in_progress" } },
          orderBy: { startedAt: "desc" },
          select: { id: true, size: true, total: true, answered: true, correct: true, percent: true, status: true, startedAt: true, finishedAt: true },
        }),
      ]);
      return {
        weekKey,
        topicTests: topic.map((t) => ({ id: t.id, topicSlug: t.topic.slug, topicTitle: t.topic.title, correct: t.correct, total: t.total, percent: t.percent, createdAt: t.createdAt })),
        randomTests: random,
        ...progress,
      };
    }
    const rows = await this.prisma.weeklyResultArchive.findMany({
      where: { userId, weekKey, kind: { in: ["topic_test", "random_test"] } },
      orderBy: { sourceCreatedAt: "desc" },
    });
    type TopicData = { topicSlug: string; topicTitle: string; correct: number; total: number; percent: number; createdAt: string };
    type RandomData = { size: number; total: number; answered: number; correct: number; percent: number; status: string; startedAt: string; finishedAt: string | null };
    return {
      weekKey,
      topicTests: rows.filter((r) => r.kind === "topic_test").map((r) => ({ id: r.sourceId, ...(r.data as unknown as TopicData) })),
      // Random test javoblari (savollar bo'yicha) arxivda saqlangan, ro'yxatda faqat yig'indi.
      randomTests: rows.filter((r) => r.kind === "random_test").map((r) => {
        const { size, total, answered, correct, percent, status, startedAt, finishedAt } = r.data as unknown as RandomData;
        return { id: r.sourceId, size, total, answered, correct, percent, status, startedAt, finishedAt };
      }),
      ...progress,
    };
  }

  async logUserReset(admin: AdminUser, ip: string, userId: string, result: { weekKey: string; skipped: boolean; affectedUsers: number; counts: unknown }) {
    await this.audit.log(admin, ip, { action: "user.progress_reset", entityType: "user", entityId: userId, after: result as unknown as Prisma.InputJsonValue });
  }

  async assertUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");
  }

  async setExempt(admin: AdminUser, ip: string, userId: string, enabled: boolean) {
    const before = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, weeklyResetExempt: true } });
    if (!before) throw new NotFoundException("Foydalanuvchi topilmadi");
    const after = await this.prisma.user.update({ where: { id: userId }, data: { weeklyResetExempt: enabled }, select: { id: true, weeklyResetExempt: true } });
    await this.audit.log(admin, ip, { action: "user.weekly_reset_exempt", entityType: "user", entityId: userId, before, after });
    return after;
  }

  async logManual(admin: AdminUser, ip: string, result: { weekKey: string; skipped: boolean; affectedUsers: number; counts: unknown }) {
    await this.audit.log(admin, ip, { action: "results.weekly_reset", entityType: "weekly_reset", entityId: result.weekKey, after: result as unknown as Prisma.InputJsonValue });
  }

  // ── Umumiy ko'rinish ──

  async resets(now = new Date()) {
    const items = await this.prisma.weeklyReset.findMany({ orderBy: { startedAt: "desc" }, take: 100 });
    // Umumiy yangilanish (bitta foydalanuvchi nollashlari — userId bilan — hisobga olinmaydi).
    const last = items.find((r) => r.status === "done" && !r.userId);
    return {
      serverNow: now,
      lastResetAt: last?.finishedAt ?? null,
      lastBoundary: lastResetBoundary(now),
      nextResetAt: nextResetAt(now),
      items: items.map((r) => ({
        weekKey: r.weekKey,
        status: r.status,
        triggeredBy: r.triggeredBy,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        affectedUsers: r.affectedUsers,
        counts: r.counts,
        error: r.error,
        userId: r.userId,
      })),
    };
  }

  /** Tanlangan hafta (yoki "current") bo'yicha barcha foydalanuvchilar natijalari. */
  async weekUsers(weekKey: string, query: { q?: string; page: number; pageSize: number }) {
    let userIds: string[] | null = null;
    if (query.q?.trim()) userIds = (await this.prisma.user.findMany({ where: userSearch(query.q), select: { id: true }, take: 500 })).map((u) => u.id);
    if (userIds && userIds.length === 0) return { weekKey, total: 0, page: query.page, pageSize: query.pageSize, items: [] };
    const filter = userIds ? Prisma.sql`AND "userId" IN (${Prisma.join(userIds)})` : Prisma.empty;
    const source =
      weekKey === CURRENT
        ? Prisma.sql`SELECT * FROM (${this.currentRowsSql()}) c WHERE TRUE ${filter}`
        : Prisma.sql`SELECT "userId", kind, (data->>'percent')::numeric AS percent, (data->>'correct')::int AS correct, (data->>'total')::int AS total
            FROM "WeeklyResultArchive" WHERE "weekKey" = ${weekKey} AND kind IN ('topic_test', 'random_test') ${filter}`;
    const [count, rows] = await Promise.all([
      this.prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT "userId") AS n FROM (${source}) s`,
      this.prisma.$queryRaw<(AggRow & { userId: string })[]>`
        SELECT "userId", ${weekKey}::text AS "weekKey", COUNT(*) AS tests,
          COUNT(*) FILTER (WHERE kind = 'topic_test') AS topic, COUNT(*) FILTER (WHERE kind = 'random_test') AS random,
          AVG(percent) AS avg, SUM("correct") AS correct, SUM("total") AS total
        FROM (${source}) s GROUP BY "userId" ORDER BY COUNT(*) DESC, "userId"
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    ]);
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, firstName: true, lastName: true, phone: true, login: true, type: true, weeklyResetExempt: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      weekKey,
      total: Number(count[0]?.n ?? 0),
      page: query.page,
      pageSize: query.pageSize,
      items: rows.map((r) => ({ user: byId.get(r.userId) ?? { id: r.userId, firstName: null, lastName: null, phone: null, login: null, type: "SELF", weeklyResetExempt: false }, ...this.summary(r, { from: null, to: null }) })),
    };
  }
}
