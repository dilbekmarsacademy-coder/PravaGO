import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PASS_PERCENT } from "../../common/rules";
import { loadCourseTopics } from "../progress";

const DAY_MS = 24 * 60 * 60 * 1000;
/** "Bugun" — Toshkent vaqti bo'yicha (UTC+5). */
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;

export type RangeKey = "today" | "7d" | "30d";

function rangeStart(range: RangeKey, now = Date.now()): Date {
  if (range === "today") {
    const local = now + TZ_OFFSET_MS;
    return new Date(local - (local % DAY_MS) - TZ_OFFSET_MS);
  }
  return new Date(now - (range === "7d" ? 7 : 30) * DAY_MS);
}

const n = (v: unknown) => Number(v ?? 0);

/** Yig'ma statistika — shaxsiy ma'lumotsiz (AI tahlilga ham shu yuboriladi). */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  private async distinctVisitors(since: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(DISTINCT "visitorId") AS c FROM "AnalyticsEvent" WHERE "createdAt" >= ${since}`;
    return n(rows[0]?.c);
  }

  async dashboard(range: RangeKey) {
    const now = Date.now();
    const since = rangeStart(range, now);
    const [dau, wau, mau] = await Promise.all([
      this.distinctVisitors(new Date(now - DAY_MS)),
      this.distinctVisitors(new Date(now - 7 * DAY_MS)),
      this.distinctVisitors(new Date(now - 30 * DAY_MS)),
    ]);

    const [registered, registeredTotal, paidInRange, paidTotal, pendingPayments, registeredPaid] = await Promise.all([
      this.prisma.user.count({ where: { registeredAt: { gte: since } } }),
      this.prisma.user.count({ where: { registeredAt: { not: null } } }),
      this.prisma.payment.count({ where: { status: "CONFIRMED", confirmedAt: { gte: since } } }),
      this.prisma.user.count({ where: { paymentStatus: "PAID" } }),
      this.prisma.payment.count({ where: { status: "PENDING" } }),
      this.prisma.user.count({ where: { registeredAt: { gte: since }, paymentStatus: "PAID" } }),
    ]);

    const session = await this.prisma.$queryRaw<{ avg: number | null; sessions: bigint }[]>`
      SELECT AVG(d) AS avg, COUNT(*) AS sessions FROM (
        SELECT EXTRACT(EPOCH FROM (MAX("createdAt") - MIN("createdAt"))) AS d
        FROM "AnalyticsEvent" WHERE "createdAt" >= ${since}
        GROUP BY "sessionId" HAVING COUNT(*) > 1
      ) s`;

    const bucket = range === "today" ? "hour" : "day";
    const series = await this.prisma.$queryRaw<{ t: Date; visitors: bigint; views: bigint }[]>`
      SELECT date_trunc(${bucket}, "createdAt" + interval '5 hours') AS t,
             COUNT(DISTINCT "visitorId") AS visitors,
             COUNT(*) FILTER (WHERE type = 'page_view') AS views
      FROM "AnalyticsEvent" WHERE "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1`;
    const regSeries = await this.prisma.$queryRaw<{ t: Date; c: bigint }[]>`
      SELECT date_trunc(${bucket}, "registeredAt" + interval '5 hours') AS t, COUNT(*) AS c
      FROM "User" WHERE "registeredAt" >= ${since} GROUP BY 1 ORDER BY 1`;

    const devices = await this.prisma.$queryRaw<{ device: string; c: bigint }[]>`
      SELECT device, COUNT(DISTINCT "visitorId") AS c FROM "AnalyticsEvent" WHERE "createdAt" >= ${since} GROUP BY device`;

    const topics = await loadCourseTopics(this.prisma);
    const collectionTopics = await this.prisma.topic.findMany({ where: { kind: "collection" }, select: { id: true, slug: true, title: true } });
    const titleById = new Map<string, { slug: string; title: string }>([
      ...topics.map((t) => [t.id, { slug: t.slug, title: t.title }] as const),
      ...collectionTopics.map((t) => [t.id, { slug: t.slug, title: t.title }] as const),
    ]);

    const attemptsByTopic = await this.prisma.topicTestAttempt.groupBy({
      by: ["topicId"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _avg: { percent: true },
    });
    const passedByTopic = await this.prisma.topicTestAttempt.groupBy({
      by: ["topicId"],
      where: { createdAt: { gte: since }, percent: { gte: PASS_PERCENT } },
      _count: { _all: true },
    });
    const passedMap = new Map(passedByTopic.map((p) => [p.topicId, p._count._all]));
    const mostSolved = attemptsByTopic
      .map((a) => ({
        slug: titleById.get(a.topicId)?.slug ?? a.topicId,
        title: titleById.get(a.topicId)?.title ?? "",
        attempts: a._count._all,
        avgPercent: Math.round(a._avg.percent ?? 0),
        passRate: a._count._all ? Math.round(((passedMap.get(a.topicId) ?? 0) / a._count._all) * 100) : 0,
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 10);

    const startFinish = await this.prisma.$queryRaw<{ slug: string; started: bigint; finished: bigint }[]>`
      SELECT "topicSlug" AS slug,
             COUNT(DISTINCT "sessionId") FILTER (WHERE type = 'test_start') AS started,
             COUNT(DISTINCT "sessionId") FILTER (WHERE type = 'test_finish') AS finished
      FROM "AnalyticsEvent"
      WHERE "createdAt" >= ${since} AND "topicSlug" IS NOT NULL AND type IN ('test_start', 'test_finish')
      GROUP BY 1`;
    const slugTitle = new Map([...titleById.values()].map((t) => [t.slug, t.title]));
    const abandoned = startFinish
      .map((r) => ({ slug: r.slug, title: slugTitle.get(r.slug) ?? "", started: n(r.started), finished: n(r.finished), abandoned: Math.max(0, n(r.started) - n(r.finished)) }))
      .filter((r) => r.abandoned > 0)
      .sort((a, b) => b.abandoned - a.abandoned)
      .slice(0, 10);

    const wrong = await this.prisma.$queryRaw<{ questionId: string; total: bigint; wrong: bigint }[]>`
      SELECT "questionId", COUNT(*) AS total, COUNT(*) FILTER (WHERE NOT correct) AS wrong
      FROM "AnswerLog" WHERE "createdAt" >= ${since}
      GROUP BY 1 HAVING COUNT(*) FILTER (WHERE NOT correct) > 0
      ORDER BY wrong DESC, total DESC LIMIT 20`;
    const wrongQuestions = wrong.length
      ? await this.prisma.question.findMany({
          where: { id: { in: wrong.map((w) => w.questionId) } },
          select: { id: true, order: true, text: true, textLatn: true, topic: { select: { slug: true } } },
        })
      : [];
    const qById = new Map(wrongQuestions.map((q) => [q.id, q]));
    const topWrong = wrong.flatMap((w) => {
      const q = qById.get(w.questionId);
      return q ? [{ questionId: q.id, topicSlug: q.topic.slug, order: q.order, text: q.textLatn ?? q.text, answers: n(w.total), wrong: n(w.wrong), wrongRate: Math.round((n(w.wrong) / Math.max(1, n(w.total))) * 100) }] : [];
    });

    return {
      range,
      since,
      generatedAt: new Date(now),
      active: { dau, wau, mau },
      registrations: { inRange: registered, total: registeredTotal },
      payments: { confirmedInRange: paidInRange, paidUsersTotal: paidTotal, pending: pendingPayments },
      conversion: { registeredInRange: registered, paidOfThem: registeredPaid, percent: registered ? Math.round((registeredPaid / registered) * 100) : 0 },
      sessions: { count: n(session[0]?.sessions), avgSec: Math.round(n(session[0]?.avg)) },
      series: {
        bucket,
        visitors: series.map((s) => ({ t: s.t, visitors: n(s.visitors), views: n(s.views) })),
        registrations: regSeries.map((s) => ({ t: s.t, count: n(s.c) })),
      },
      devices: devices.map((d) => ({ device: d.device, visitors: n(d.c) })),
      mostSolved,
      abandoned,
      topWrong,
      funnel: await this.funnel(topics),
    };
  }

  /** Kunlar bo'yicha voronka: kunni boshlagan (kamida bitta urinish) va to'liq o'tgan ro'yxatdagi foydalanuvchilar. */
  private async funnel(topics: Awaited<ReturnType<typeof loadCourseTopics>>) {
    const best = await this.prisma.$queryRaw<{ userId: string; topicId: string; best: number }[]>(Prisma.sql`
      SELECT a."userId", a."topicId", MAX(a.percent) AS best
      FROM "TopicTestAttempt" a JOIN "User" u ON u.id = a."userId"
      WHERE u."registeredAt" IS NOT NULL GROUP BY 1, 2`);
    const days = [...new Set(topics.map((t) => t.day))].sort((a, b) => a - b);
    const byUser = new Map<string, Map<string, number>>();
    for (const row of best) {
      const m = byUser.get(row.userId) ?? new Map<string, number>();
      m.set(row.topicId, n(row.best));
      byUser.set(row.userId, m);
    }
    const registered = await this.prisma.user.count({ where: { registeredAt: { not: null } } });
    return {
      registered,
      days: days.map((day) => {
        const ids = topics.filter((t) => t.day === day).map((t) => t.id);
        let started = 0;
        let completed = 0;
        for (const m of byUser.values()) {
          if (ids.some((id) => m.has(id))) started++;
          if (ids.every((id) => (m.get(id) ?? -1) >= PASS_PERCENT)) completed++;
        }
        return { day, started, completed };
      }),
    };
  }
}
