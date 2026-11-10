import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AdminUser } from "../admin/admin-request";
import { AuditService } from "../admin/audit.service";
import { userSearch } from "../payments/payments.service";
import { PrismaService } from "../prisma/prisma.service";
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

  /** Bajarilgan yangilanishlar (eskidan yangiga) — hafta oraliqlari uchun. */
  private async doneResets() {
    return this.prisma.weeklyReset.findMany({ where: { status: "done" }, orderBy: { startedAt: "asc" }, select: { weekKey: true, startedAt: true, finishedAt: true } });
  }

  private ranges(resets: { weekKey: string; startedAt: Date }[]) {
    const map = new Map<string, { from: Date | null; to: Date }>();
    resets.forEach((r, i) => map.set(r.weekKey, { from: resets[i - 1]?.startedAt ?? null, to: r.startedAt }));
    return map;
  }

  private summary(row: AggRow, range: { from: Date | null; to: Date | null }): WeekSummary {
    const correct = Number(row.correct ?? 0);
    return {
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
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, weeklyResetExempt: true } });
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");
    const [resets, archived, current] = await Promise.all([
      this.doneResets(),
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
    ]);
    const ranges = this.ranges(resets);
    const lastReset = resets.at(-1)?.startedAt ?? null;
    const weeks = archived
      .map((r) => this.summary(r, ranges.get(r.weekKey) ?? { from: null, to: null }))
      .sort((a, b) => (b.to?.getTime() ?? 0) - (a.to?.getTime() ?? 0));
    return {
      exempt: user.weeklyResetExempt,
      current: this.summary(current[0] ?? { weekKey: CURRENT, tests: 0n, topic: 0n, random: 0n, avg: null, correct: 0n, total: 0n }, { from: lastReset, to: null }),
      weeks,
    };
  }

  /** Bitta hafta (yoki "current") batafsil: mavzu testlari va random testlar alohida. */
  async userWeekDetail(userId: string, weekKey: string) {
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
    };
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
    const last = items.find((r) => r.status === "done");
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
