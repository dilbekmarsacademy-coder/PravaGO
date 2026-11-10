import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { INITIAL_WEEK_KEY, isBannerVisible, lastResetBoundary, manualWeekKey, nextResetAt, bannerFrom, weekKeyOf } from "./schedule";

// Haftalik natijalar yangilanishi (har dushanba 22:00, Asia/Tashkent).
//
// Foydalanuvchi tomonida natijalar nolga tushadi, lekin hech narsa o'chirilmaydi:
// avval har bir yozuv WeeklyResultArchive'ga nusxalanadi, keyin manba yozuvlarga
// `archivedAt` qo'yiladi — foydalanuvchi API'lari faqat `archivedAt = null`
// yozuvlarni ko'radi, admin esa hammasini. Ikkalasi bitta tranzaksiyada:
// arxivlash xato bersa, nollash ham bajarilmaydi.
//
// Yangilanadi: mavzu testlari (TopicTestAttempt), tugallangan random testlar
// (RandomTestAttempt), javoblar logi (AnswerLog) va ular asosidagi AI xulosa
// (AiStudentInsight). Tegilmaydi: akkaunt, to'lovlar, video progress,
// saqlanganlar, yakuniy imtihon va sertifikatlar, tugallanmagan random test.
//
// Ishga tushirish: Vercel Cron (backend/vercel.json → POST /cron/weekly-reset),
// @Cron (doimiy ishlaydigan serverda), catch-up (GET /meta/reset-status va
// cron chaqirilganda: o'tgan dushanba 22:00 bajarilmagan bo'lsa) va admin
// "Hozir yangilash". Bir martalik "initial-launch" — INITIAL_RESET_ON_DEPLOY=true.

export type ResetTrigger = "cron" | "catchup" | "manual" | "initial";

export interface ResetCounts {
  topicTests: number;
  randomTests: number;
  answers: number;
  aiInsights: number;
}

export interface ResetResult {
  weekKey: string;
  /** Allaqachon bajarilgan yoki boshqa jarayon bajaryapti. */
  skipped: boolean;
  dryRun: boolean;
  affectedUsers: number;
  counts: ResetCounts;
}

interface RunOptions {
  weekKey: string;
  triggeredBy: ResetTrigger;
  /** true — weeklyResetExempt belgisi hisobga olinmaydi (faqat "initial-launch"). */
  includeExempt: boolean;
  dryRun?: boolean;
  adminId?: string;
  now?: Date;
}

/** Shu vaqtdan eski "running" — uzilib qolgan deb hisoblanadi va qayta olinadi. */
const STALE_RUNNING_MS = 15 * 60_000;
const ZERO: ResetCounts = { topicTests: 0, randomTests: 0, answers: 0, aiInsights: 0 };

/** Ishtirokchi foydalanuvchilar sharti (SQL): exempt bo'lmaganlar yoki hammasi. */
function userFilter(alias: string, includeExempt: boolean): Prisma.Sql {
  return includeExempt
    ? Prisma.empty
    : Prisma.sql`AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = ${Prisma.raw(`${alias}."userId"`)} AND u."weeklyResetExempt")`;
}

@Injectable()
export class WeeklyResetService implements OnApplicationBootstrap {
  private readonly log = new Logger("WeeklyReset");
  /** Shu instansiyada tekshirilgan oxirgi hafta (catch-up har so'rovda bazaga bormasin). */
  private checkedWeekKey: string | null = null;
  private catchUpRunning: Promise<unknown> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  // ── Ishga tushirish nuqtalari ──

  /** Deploy'dan keyingi birinchi ishga tushish: bir martalik "initial-launch". Xato ilovani qulatmaydi. */
  async onApplicationBootstrap(): Promise<void> {
    if (process.env.INITIAL_RESET_ON_DEPLOY !== "true") return;
    try {
      await this.runInitialIfNeeded();
    } catch (err) {
      // Masalan, migratsiya hali bajarilmagan (jadval yo'q) — keyingi ishga tushishda qayta uriniladi.
      this.log.error(`initial-launch bajarilmadi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Doimiy ishlaydigan serverda (VPS). Vercel serverless'da ishonchli emas — u yerda Vercel Cron. */
  @Cron("0 22 * * 1", { name: "weekly-reset", timeZone: "Asia/Tashkent" })
  async scheduled(): Promise<void> {
    try {
      await this.runWeekly("cron");
    } catch (err) {
      this.log.error(`Haftalik yangilanish xatosi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Oxirgi dushanba 22:00 uchun haftalik yangilanish (bajarilmagan bo'lsa). */
  async runWeekly(triggeredBy: "cron" | "catchup", now = new Date()): Promise<ResetResult> {
    const weekKey = weekKeyOf(lastResetBoundary(now));
    return this.run({ weekKey, triggeredBy, includeExempt: false, now });
  }

  /**
   * Catch-up: server uxlab qolgan yoki cron kechikkan bo'lsa, birinchi so'rovda
   * bajariladi. Faqat tizim ishga tushirilgan bo'lsa (kamida bitta yangilanish
   * yozuvi bor) — aks holda yangi versiya deploy bo'lishi bilan kutilmagan
   * yangilanish bo'lib ketmasligi uchun.
   */
  async catchUp(now = new Date()): Promise<void> {
    const weekKey = weekKeyOf(lastResetBoundary(now));
    if (this.checkedWeekKey === weekKey) return;
    if (this.catchUpRunning) {
      await this.catchUpRunning;
      return;
    }
    this.catchUpRunning = (async () => {
      try {
        const [initialized, current] = await Promise.all([
          this.prisma.weeklyReset.count({ where: { status: { in: ["done", "covered"] } } }),
          this.prisma.weeklyReset.findUnique({ where: { weekKey }, select: { status: true } }),
        ]);
        if (!initialized) return;
        if (current && (current.status === "done" || current.status === "covered")) {
          this.checkedWeekKey = weekKey;
          return;
        }
        const res = await this.run({ weekKey, triggeredBy: "catchup", includeExempt: false, now });
        if (!res.skipped) this.checkedWeekKey = weekKey;
      } catch (err) {
        this.log.error(`catch-up xatosi: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        this.catchUpRunning = null;
      }
    })();
    await this.catchUpRunning;
  }

  /**
   * "initial-launch": barcha foydalanuvchilar (exempt ham) bir marta. Keyin
   * joriy hafta "covered" deb belgilanadi — catch-up o'tgan dushanbani qayta bajarmaydi.
   */
  async runInitialIfNeeded(now = new Date()): Promise<ResetResult | null> {
    const existing = await this.prisma.weeklyReset.findUnique({ where: { weekKey: INITIAL_WEEK_KEY }, select: { status: true } });
    if (existing?.status === "done") return null;
    const res = await this.run({ weekKey: INITIAL_WEEK_KEY, triggeredBy: "initial", includeExempt: true, now });
    if (!res.skipped) {
      const finished = await this.prisma.weeklyReset.findUnique({ where: { weekKey: INITIAL_WEEK_KEY }, select: { finishedAt: true } });
      await this.prisma.weeklyReset.createMany({
        data: [
          {
            weekKey: weekKeyOf(lastResetBoundary(now)),
            status: "covered",
            triggeredBy: "initial",
            startedAt: finished?.finishedAt ?? now,
            finishedAt: finished?.finishedAt ?? now,
          },
        ],
        skipDuplicates: true,
      });
      this.log.log(`initial-launch: ${res.affectedUsers} ta foydalanuvchi, ${JSON.stringify(res.counts)}`);
    }
    return res;
  }

  /** Admin "Hozir yangilash" (exempt'larga tegmaydi). */
  manual(adminId: string, dryRun: boolean, now = new Date()): Promise<ResetResult> {
    return this.run({ weekKey: manualWeekKey(now), triggeredBy: "manual", includeExempt: false, dryRun, adminId, now });
  }

  // ── Asosiy amal ──

  async run(opts: RunOptions): Promise<ResetResult> {
    const now = opts.now ?? new Date();
    if (opts.dryRun) {
      const preview = await this.preview(opts.includeExempt);
      return { weekKey: opts.weekKey, skipped: false, dryRun: true, ...preview };
    }
    if (!(await this.acquire(opts, now))) {
      return { weekKey: opts.weekKey, skipped: true, dryRun: false, affectedUsers: 0, counts: { ...ZERO } };
    }
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const users = await this.affectedUserIds(tx, opts.includeExempt);
          // Har tur: avval arxiv, keyin belgilash. Istalgan qadam xatosi — butun tranzaksiya qaytadi.
          const topicTests = await this.archiveTopicTests(tx, opts, now);
          const randomTests = await this.archiveRandomTests(tx, opts, now);
          const answers = await this.archiveAnswers(tx, opts, now);
          const aiInsights = await this.archiveInsights(tx, opts, now);
          return { affectedUsers: users, counts: { topicTests, randomTests, answers, aiInsights } };
        },
        { timeout: 120_000, maxWait: 10_000 },
      );
      await this.prisma.weeklyReset.update({
        where: { weekKey: opts.weekKey },
        data: { status: "done", finishedAt: new Date(), affectedUsers: result.affectedUsers, counts: result.counts as unknown as Prisma.InputJsonValue },
      });
      this.log.log(`${opts.weekKey} (${opts.triggeredBy}): ${result.affectedUsers} ta foydalanuvchi, ${JSON.stringify(result.counts)}`);
      return { weekKey: opts.weekKey, skipped: false, dryRun: false, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.weeklyReset
        .update({ where: { weekKey: opts.weekKey }, data: { status: "failed", finishedAt: new Date(), error: message.slice(0, 500) } })
        .catch(() => undefined);
      throw err;
    }
  }

  /**
   * Idempotentlik: weekKey unikal. Yangi kalit — "running" yoziladi; "failed"
   * yoki uzilib qolgan "running" — qayta olinadi; "done"/"covered" — o'tkazib yuboriladi.
   */
  private async acquire(opts: RunOptions, now: Date): Promise<boolean> {
    try {
      await this.prisma.weeklyReset.create({
        data: { weekKey: opts.weekKey, status: "running", triggeredBy: opts.triggeredBy, startedAt: now, adminId: opts.adminId },
      });
      return true;
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    }
    const taken = await this.prisma.weeklyReset.updateMany({
      where: {
        weekKey: opts.weekKey,
        OR: [{ status: "failed" }, { status: "running", startedAt: { lt: new Date(now.getTime() - STALE_RUNNING_MS) } }],
      },
      data: { status: "running", triggeredBy: opts.triggeredBy, startedAt: now, finishedAt: null, error: null, adminId: opts.adminId },
    });
    return taken.count > 0;
  }

  /** dryRun: nechta foydalanuvchi va yozuv ta'sirlanadi — hech narsa o'zgarmaydi. */
  async preview(includeExempt: boolean): Promise<{ affectedUsers: number; counts: ResetCounts }> {
    const exempt = includeExempt ? {} : { user: { weeklyResetExempt: false } };
    const [topicTests, randomTests, answers, insights, users] = await Promise.all([
      this.prisma.topicTestAttempt.count({ where: { archivedAt: null, ...exempt } }),
      this.prisma.randomTestAttempt.count({ where: { archivedAt: null, status: { not: "in_progress" }, ...exempt } }),
      this.prisma.answerLog.count({ where: { archivedAt: null, ...exempt } }),
      this.prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "AiStudentInsight" a WHERE TRUE ${userFilter("a", includeExempt)}`,
      this.affectedUserIds(this.prisma, includeExempt),
    ]);
    const aiInsights = Number(insights[0]?.n ?? 0);
    return { affectedUsers: users, counts: { topicTests, randomTests, answers, aiInsights } };
  }

  private async affectedUserIds(db: Prisma.TransactionClient | PrismaService, includeExempt: boolean): Promise<number> {
    const rows = await db.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(DISTINCT x."userId") AS n FROM (
        SELECT "userId" FROM "TopicTestAttempt" WHERE "archivedAt" IS NULL
        UNION SELECT "userId" FROM "RandomTestAttempt" WHERE "archivedAt" IS NULL AND "status" <> 'in_progress'
        UNION SELECT "userId" FROM "AnswerLog" WHERE "archivedAt" IS NULL
      ) x WHERE TRUE ${userFilter("x", includeExempt)}`;
    return Number(rows[0]?.n ?? 0);
  }

  // Har bir qadam: INSERT ... SELECT (nusxa) → UPDATE (belgilash). Soni teng bo'lishi shart.

  async archiveTopicTests(tx: Prisma.TransactionClient, o: RunOptions, now: Date): Promise<number> {
    const archived = await tx.$executeRaw`
      INSERT INTO "WeeklyResultArchive" ("id", "userId", "kind", "sourceId", "weekKey", "data", "sourceCreatedAt", "archivedAt")
      SELECT gen_random_uuid()::text, a."userId", 'topic_test', a."id", ${o.weekKey},
        jsonb_build_object('topicSlug', t."slug", 'topicTitle', t."title", 'correct', a."correct", 'total', a."total", 'percent', a."percent", 'createdAt', a."createdAt"),
        a."createdAt", ${now}
      FROM "TopicTestAttempt" a JOIN "Topic" t ON t."id" = a."topicId"
      WHERE a."archivedAt" IS NULL ${userFilter("a", o.includeExempt)}`;
    const cleared = await tx.$executeRaw`
      UPDATE "TopicTestAttempt" a SET "archivedAt" = ${now}, "archiveWeekKey" = ${o.weekKey}
      WHERE a."archivedAt" IS NULL ${userFilter("a", o.includeExempt)}`;
    return this.same("topic_test", archived, cleared);
  }

  /** Tugallanmagan random test arxivlanmaydi — tugagach yangi hafta hisobiga yoziladi. */
  async archiveRandomTests(tx: Prisma.TransactionClient, o: RunOptions, now: Date): Promise<number> {
    const archived = await tx.$executeRaw`
      INSERT INTO "WeeklyResultArchive" ("id", "userId", "kind", "sourceId", "weekKey", "data", "sourceCreatedAt", "archivedAt")
      SELECT gen_random_uuid()::text, a."userId", 'random_test', a."id", ${o.weekKey},
        jsonb_build_object(
          'size', a."size", 'total', a."total", 'status', a."status", 'answered', a."answered", 'correct', a."correct", 'percent', a."percent",
          'startedAt', a."startedAt", 'finishedAt', a."finishedAt",
          'answers', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('position', r."position", 'questionId', r."questionId", 'selectedOptionId', r."selectedOptionId", 'correct', r."correct", 'answeredAt', r."answeredAt") ORDER BY r."position")
            FROM "RandomTestAnswer" r WHERE r."attemptId" = a."id"), '[]'::jsonb)),
        a."startedAt", ${now}
      FROM "RandomTestAttempt" a
      WHERE a."archivedAt" IS NULL AND a."status" <> 'in_progress' ${userFilter("a", o.includeExempt)}`;
    const cleared = await tx.$executeRaw`
      UPDATE "RandomTestAttempt" a SET "archivedAt" = ${now}, "archiveWeekKey" = ${o.weekKey}
      WHERE a."archivedAt" IS NULL AND a."status" <> 'in_progress' ${userFilter("a", o.includeExempt)}`;
    return this.same("random_test", archived, cleared);
  }

  async archiveAnswers(tx: Prisma.TransactionClient, o: RunOptions, now: Date): Promise<number> {
    const archived = await tx.$executeRaw`
      INSERT INTO "WeeklyResultArchive" ("id", "userId", "kind", "sourceId", "weekKey", "data", "sourceCreatedAt", "archivedAt")
      SELECT gen_random_uuid()::text, a."userId", 'answer', a."id", ${o.weekKey},
        jsonb_build_object('questionId', a."questionId", 'correct', a."correct", 'createdAt', a."createdAt"),
        a."createdAt", ${now}
      FROM "AnswerLog" a
      WHERE a."archivedAt" IS NULL ${userFilter("a", o.includeExempt)}`;
    const cleared = await tx.$executeRaw`
      UPDATE "AnswerLog" a SET "archivedAt" = ${now}, "archiveWeekKey" = ${o.weekKey}
      WHERE a."archivedAt" IS NULL ${userFilter("a", o.includeExempt)}`;
    return this.same("answer", archived, cleared);
  }

  /** AI xulosa eski natijalarga asoslangan — nusxasi arxivga, o'zi o'chiriladi (keyin yangidan tuziladi). */
  async archiveInsights(tx: Prisma.TransactionClient, o: RunOptions, now: Date): Promise<number> {
    const archived = await tx.$executeRaw`
      INSERT INTO "WeeklyResultArchive" ("id", "userId", "kind", "sourceId", "weekKey", "data", "sourceCreatedAt", "archivedAt")
      SELECT gen_random_uuid()::text, a."userId", 'ai_insight', a."userId" || ':' || ${o.weekKey}, ${o.weekKey},
        jsonb_build_object('locale', a."locale", 'content', a."content", 'basedOnAttemptAt', a."basedOnAttemptAt", 'updatedAt', a."updatedAt"),
        a."createdAt", ${now}
      FROM "AiStudentInsight" a
      WHERE TRUE ${userFilter("a", o.includeExempt)}`;
    const cleared = await tx.$executeRaw`DELETE FROM "AiStudentInsight" a WHERE TRUE ${userFilter("a", o.includeExempt)}`;
    return this.same("ai_insight", archived, cleared);
  }

  private same(kind: string, archived: number, cleared: number): number {
    if (archived !== cleared) throw new Error(`${kind}: arxivlangan (${archived}) va nollangan (${cleared}) soni teng emas`);
    return cleared;
  }

  // ── Holat (lenta va jonli yangilash) ──

  async status(user: { id: string; registered: boolean; exempt: boolean } | null, now = new Date()) {
    await this.catchUp(now);
    const weekKey = weekKeyOf(lastResetBoundary(now));
    const [current, last] = await Promise.all([
      this.prisma.weeklyReset.findUnique({ where: { weekKey }, select: { status: true } }),
      this.prisma.weeklyReset.findFirst({
        // Exempt foydalanuvchiga faqat "initial-launch" tegadi.
        where: { status: "done", ...(user?.exempt ? { weekKey: INITIAL_WEEK_KEY } : {}) },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true },
      }),
    ]);
    const exempt = Boolean(user?.exempt);
    return {
      serverNow: now.toISOString(),
      nextResetAt: nextResetAt(now).toISOString(),
      bannerFrom: bannerFrom(now).toISOString(),
      // Faqat tizimga kirgan (ro'yxatdan o'tgan) va exempt bo'lmagan foydalanuvchiga.
      bannerVisible: Boolean(user?.registered) && !exempt && isBannerVisible(now, current?.status === "running"),
      lastResetAt: last?.finishedAt?.toISOString() ?? null,
      exempt,
    };
  }
}
