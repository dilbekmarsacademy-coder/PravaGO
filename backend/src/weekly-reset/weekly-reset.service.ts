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
// (RandomTestAttempt), javoblar logi (AnswerLog), ular asosidagi AI xulosa
// (AiStudentInsight), VIDEO progressi (LessonProgress: foiz, joy, "ko'rildi") va
// KALIT SO'ZLAR progressi (KeywordReview "Tanishdim" + TopicKeywordsView
// "Tanishib chiqdim"). Shu bilan foydalanuvchida yangi oqim (video → kalit
// so'zlar → test, User.topicFlowGatingEnabled) yoqiladi.
// Tegilmaydi: akkaunt, profil, tarif/to'lovlar, saqlanganlar, yakuniy imtihon
// urinishlari va sertifikatlar, tugallanmagan random test. Yakuniy imtihon qulfi
// qayta yopilmaydi: o'tilgan testlar arxivda ham hisoblanadi, video esa
// LessonProgress.firstCompletedAt orqali (nollanmaydi).
// weeklyResetExempt akkauntga (masalan "Umar") hech qaysi qadam tegmaydi —
// video/kalit so'zlar progressi va oqim bayrog'i "initial-launch"da ham.
//
// Ishga tushirish: Vercel Cron (backend/vercel.json → POST /cron/weekly-reset),
// @Cron (doimiy ishlaydigan serverda), catch-up (GET /meta/reset-status va
// cron chaqirilganda: o'tgan dushanba 22:00 bajarilmagan bo'lsa) va admin
// "Hozir yangilash". Bir martalik "initial-launch" — INITIAL_RESET_ON_DEPLOY=true.
// Bitta foydalanuvchi: admin "Progressni to'liq nolga tushirish" va bir martalik
// "tester-reset" (TESTER_RESET_ON_DEPLOY=true) — xuddi shu qadamlar, faqat u uchun.

export type ResetTrigger = "cron" | "catchup" | "manual" | "initial" | "tester" | "user";

export interface ResetCounts {
  topicTests: number;
  randomTests: number;
  answers: number;
  aiInsights: number;
  /** Nollangan video progress yozuvlari (LessonProgress). */
  videoProgress: number;
  /** O'chirilgan "Tanishdim" belgilari (KeywordReview). */
  keywordReviews: number;
  /** O'chirilgan "Tanishib chiqdim" belgilari (TopicKeywordsView). */
  keywordViews: number;
  /** Yangi oqim yoqilgan foydalanuvchilar (topicFlowGatingEnabled false → true). */
  flowEnabled: number;
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
  /** Faqat shu foydalanuvchi (exempt belgisi ahamiyatsiz) — "tester-reset" / admin nollashi. */
  userId?: string;
}

export const TESTER_WEEK_KEY = "tester-reset";
/** Tester akkaunti nomi (ism, familiya yoki login, katta-kichik harf farqsiz). */
const TESTER_NAME = "tester";

export interface TesterCandidate {
  id: string;
  firstName: string | null;
  lastName: string | null;
  login: string | null;
  /** Telefonning oxirgi 4 raqami. */
  phoneLast4: string | null;
  exact: boolean;
}

/** Shu vaqtdan eski "running" — uzilib qolgan deb hisoblanadi va qayta olinadi. */
const STALE_RUNNING_MS = 15 * 60_000;
const ZERO: ResetCounts = { topicTests: 0, randomTests: 0, answers: 0, aiInsights: 0, videoProgress: 0, keywordReviews: 0, keywordViews: 0, flowEnabled: 0 };

/** Ishtirokchi foydalanuvchilar sharti (SQL): exempt bo'lmaganlar yoki hammasi. */
function userFilter(alias: string, includeExempt: boolean): Prisma.Sql {
  return includeExempt
    ? Prisma.empty
    : Prisma.sql`AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = ${Prisma.raw(`${alias}."userId"`)} AND u."weeklyResetExempt")`;
}

type Scope = Pick<RunOptions, "includeExempt" | "userId">;

/** Natijalar (testlar, javoblar, AI xulosa): bitta foydalanuvchi yoki umumiy filtr. */
function scopeFilter(alias: string, o: Scope): Prisma.Sql {
  if (o.userId) return Prisma.sql`AND ${Prisma.raw(`${alias}."userId"`)} = ${o.userId}`;
  return userFilter(alias, o.includeExempt);
}

/** Video/kalit so'zlar progressi va oqim bayrog'i: exempt akkauntga hech qachon tegilmaydi. */
function progressFilter(alias: string, o: Scope): Prisma.Sql {
  if (o.userId) return Prisma.sql`AND ${Prisma.raw(`${alias}."userId"`)} = ${o.userId}`;
  return userFilter(alias, false);
}

/** Video progressi bor (nollanadigan) LessonProgress yozuvi. */
const VIDEO_HAS_PROGRESS = Prisma.sql`(p."maxPosition" > 0 OR p."watchedSeconds" > 0 OR p."lastPosition" > 0 OR p."completedAt" IS NOT NULL)`;

/** "Bir foydalanuvchi" yangilanishlari umumiy jadval/holatga ta'sir qilmaydi. */
const GLOBAL_RESET = { userId: null } satisfies Prisma.WeeklyResetWhereInput;

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
    if (process.env.INITIAL_RESET_ON_DEPLOY === "true") {
      try {
        await this.runInitialIfNeeded();
      } catch (err) {
        // Masalan, migratsiya hali bajarilmagan (jadval yo'q) — keyingi ishga tushishda qayta uriniladi.
        this.log.error(`initial-launch bajarilmadi: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (process.env.TESTER_RESET_ON_DEPLOY === "true") {
      try {
        await this.runTesterResetIfNeeded();
      } catch (err) {
        this.log.error(`tester-reset bajarilmadi: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /** "tester" nomzodlari: aniq mos (ism/familiya/login = "tester") va o'xshashlari (ichida "tester"). */
  async testerCandidates(): Promise<TesterCandidate[]> {
    const like = { contains: TESTER_NAME, mode: "insensitive" as const };
    const rows = await this.prisma.user.findMany({
      where: { OR: [{ firstName: like }, { lastName: like }, { login: like }] },
      select: { id: true, firstName: true, lastName: true, login: true, phone: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    const isTester = (v: string | null) => (v ?? "").trim().toLowerCase() === TESTER_NAME;
    return rows.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      login: u.login,
      phoneLast4: u.phone ? u.phone.slice(-4) : null,
      exact: isTester(u.firstName) || isTester(u.lastName) || isTester(u.login),
    }));
  }

  /**
   * Bir martalik "tester-reset": aynan BITTA "tester" akkaunti topilsa — uning
   * barcha natijalari, video va kalit so'zlar progressi arxivlanib nollanadi va
   * yangi oqim yoqiladi. Bir nechta yoki umuman topilmasa — hech narsa
   * qilinmaydi (nomzodlar logga yoziladi). Idempotent: "tester-reset" yozuvi
   * "done" bo'lsa qayta bajarilmaydi.
   */
  async runTesterResetIfNeeded(now = new Date()): Promise<{ result: ResetResult | null; candidates: TesterCandidate[] }> {
    const existing = await this.prisma.weeklyReset.findUnique({ where: { weekKey: TESTER_WEEK_KEY }, select: { status: true } });
    if (existing?.status === "done") return { result: null, candidates: [] };
    const candidates = await this.testerCandidates();
    const exact = candidates.filter((c) => c.exact);
    if (exact.length !== 1) {
      const list = candidates.map((c) => `${c.id} (${[c.firstName, c.lastName].filter(Boolean).join(" ") || c.login || "-"}, …${c.phoneLast4 ?? "----"})`).join("; ");
      this.log.warn(`tester-reset: aniq mos akkauntlar soni ${exact.length} (1 bo'lishi kerak) — hech narsa qilinmadi. Nomzodlar: ${list || "yo'q"}`);
      return { result: null, candidates };
    }
    const result = await this.run({ weekKey: TESTER_WEEK_KEY, triggeredBy: "tester", includeExempt: true, userId: exact[0].id, now });
    if (!result.skipped) this.log.log(`tester-reset: ${exact[0].id} — ${JSON.stringify(result.counts)}`);
    return { result, candidates };
  }

  /** Admin "Progressni to'liq nolga tushirish" — bitta foydalanuvchi (exempt bo'lsa ham). */
  resetUser(userId: string, adminId: string, dryRun: boolean, now = new Date()): Promise<ResetResult> {
    return this.run({ weekKey: `user-${now.toISOString()}`, triggeredBy: "user", includeExempt: true, userId, adminId, dryRun, now });
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
          this.prisma.weeklyReset.count({ where: { status: { in: ["done", "covered"] }, ...GLOBAL_RESET } }),
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
      const preview = await this.preview(opts);
      return { weekKey: opts.weekKey, skipped: false, dryRun: true, ...preview };
    }
    if (!(await this.acquire(opts, now))) {
      return { weekKey: opts.weekKey, skipped: true, dryRun: false, affectedUsers: 0, counts: { ...ZERO } };
    }
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const users = await this.affectedUserIds(tx, opts);
          // Har tur: avval arxiv, keyin belgilash/nollash. Istalgan qadam xatosi — butun tranzaksiya qaytadi.
          const topicTests = await this.archiveTopicTests(tx, opts, now);
          const randomTests = await this.archiveRandomTests(tx, opts, now);
          const answers = await this.archiveAnswers(tx, opts, now);
          const aiInsights = await this.archiveInsights(tx, opts, now);
          const videoProgress = await this.archiveVideoProgress(tx, opts, now);
          const { keywordReviews, keywordViews } = await this.archiveKeywordsProgress(tx, opts, now);
          const flowEnabled = await this.enableFlow(tx, opts, now);
          return {
            affectedUsers: users,
            counts: { topicTests, randomTests, answers, aiInsights, videoProgress, keywordReviews, keywordViews, flowEnabled },
          };
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
        data: { weekKey: opts.weekKey, status: "running", triggeredBy: opts.triggeredBy, startedAt: now, adminId: opts.adminId, userId: opts.userId ?? null },
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
  async preview(o: Scope): Promise<{ affectedUsers: number; counts: ResetCounts }> {
    const n = (rows: { n: bigint }[]) => Number(rows[0]?.n ?? 0);
    const [topicTests, randomTests, answers, aiInsights, videoProgress, keywordReviews, keywordViews, flowEnabled, users] = await Promise.all([
      this.prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "TopicTestAttempt" a WHERE a."archivedAt" IS NULL ${scopeFilter("a", o)}`.then(n),
      this.prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "RandomTestAttempt" a WHERE a."archivedAt" IS NULL AND a."status" <> 'in_progress' ${scopeFilter("a", o)}`.then(n),
      this.prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "AnswerLog" a WHERE a."archivedAt" IS NULL ${scopeFilter("a", o)}`.then(n),
      this.prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "AiStudentInsight" a WHERE TRUE ${scopeFilter("a", o)}`.then(n),
      this.prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "LessonProgress" p WHERE ${VIDEO_HAS_PROGRESS} ${progressFilter("p", o)}`.then(n),
      this.prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "KeywordReview" k WHERE TRUE ${progressFilter("k", o)}`.then(n),
      this.prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "TopicKeywordsView" k WHERE TRUE ${progressFilter("k", o)}`.then(n),
      this.prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM (SELECT id AS "userId", "topicFlowGatingEnabled" FROM "User") x WHERE NOT x."topicFlowGatingEnabled" ${progressFilter("x", o)}`.then(n),
      this.affectedUserIds(this.prisma, o),
    ]);
    return { affectedUsers: users, counts: { topicTests, randomTests, answers, aiInsights, videoProgress, keywordReviews, keywordViews, flowEnabled } };
  }

  private async affectedUserIds(db: Prisma.TransactionClient | PrismaService, o: Scope): Promise<number> {
    const rows = await db.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(DISTINCT x."userId") AS n FROM (
        SELECT r."userId" FROM (
          SELECT "userId" FROM "TopicTestAttempt" WHERE "archivedAt" IS NULL
          UNION SELECT "userId" FROM "RandomTestAttempt" WHERE "archivedAt" IS NULL AND "status" <> 'in_progress'
          UNION SELECT "userId" FROM "AnswerLog" WHERE "archivedAt" IS NULL
        ) r WHERE TRUE ${scopeFilter("r", o)}
        UNION
        SELECT g."userId" FROM (
          SELECT p."userId" FROM "LessonProgress" p WHERE ${VIDEO_HAS_PROGRESS}
          UNION SELECT "userId" FROM "KeywordReview"
          UNION SELECT "userId" FROM "TopicKeywordsView"
        ) g WHERE TRUE ${progressFilter("g", o)}
      ) x`;
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
      WHERE a."archivedAt" IS NULL ${scopeFilter("a", o)}`;
    const cleared = await tx.$executeRaw`
      UPDATE "TopicTestAttempt" a SET "archivedAt" = ${now}, "archiveWeekKey" = ${o.weekKey}
      WHERE a."archivedAt" IS NULL ${scopeFilter("a", o)}`;
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
      WHERE a."archivedAt" IS NULL AND a."status" <> 'in_progress' ${scopeFilter("a", o)}`;
    const cleared = await tx.$executeRaw`
      UPDATE "RandomTestAttempt" a SET "archivedAt" = ${now}, "archiveWeekKey" = ${o.weekKey}
      WHERE a."archivedAt" IS NULL AND a."status" <> 'in_progress' ${scopeFilter("a", o)}`;
    return this.same("random_test", archived, cleared);
  }

  async archiveAnswers(tx: Prisma.TransactionClient, o: RunOptions, now: Date): Promise<number> {
    const archived = await tx.$executeRaw`
      INSERT INTO "WeeklyResultArchive" ("id", "userId", "kind", "sourceId", "weekKey", "data", "sourceCreatedAt", "archivedAt")
      SELECT gen_random_uuid()::text, a."userId", 'answer', a."id", ${o.weekKey},
        jsonb_build_object('questionId', a."questionId", 'correct', a."correct", 'createdAt', a."createdAt"),
        a."createdAt", ${now}
      FROM "AnswerLog" a
      WHERE a."archivedAt" IS NULL ${scopeFilter("a", o)}`;
    const cleared = await tx.$executeRaw`
      UPDATE "AnswerLog" a SET "archivedAt" = ${now}, "archiveWeekKey" = ${o.weekKey}
      WHERE a."archivedAt" IS NULL ${scopeFilter("a", o)}`;
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
      WHERE TRUE ${scopeFilter("a", o)}`;
    const cleared = await tx.$executeRaw`DELETE FROM "AiStudentInsight" a WHERE TRUE ${scopeFilter("a", o)}`;
    return this.same("ai_insight", archived, cleared);
  }

  /**
   * Video progressi: nusxa arxivga ("video_progress"), keyin yozuv joyida
   * nollanadi (foiz, joy, "ko'rildi"). firstCompletedAt saqlanadi — u faqat
   * yakuniy imtihon qulfi va boshlangan testni tugatish uchun, testni ochmaydi.
   */
  async archiveVideoProgress(tx: Prisma.TransactionClient, o: RunOptions, now: Date): Promise<number> {
    const archived = await tx.$executeRaw`
      INSERT INTO "WeeklyResultArchive" ("id", "userId", "kind", "sourceId", "weekKey", "data", "sourceCreatedAt", "archivedAt")
      SELECT gen_random_uuid()::text, p."userId", 'video_progress', p."id" || ':' || ${o.weekKey}, ${o.weekKey},
        jsonb_build_object(
          'lessonId', p."lessonId", 'maxPosition', p."maxPosition", 'watchedSeconds', p."watchedSeconds", 'lastPosition', p."lastPosition",
          'completedAt', p."completedAt", 'firstCompletedAt', p."firstCompletedAt", 'updatedAt', p."updatedAt"),
        p."createdAt", ${now}
      FROM "LessonProgress" p
      WHERE ${VIDEO_HAS_PROGRESS} ${progressFilter("p", o)}`;
    const cleared = await tx.$executeRaw`
      UPDATE "LessonProgress" p
      SET "maxPosition" = 0, "watchedSeconds" = 0, "lastPosition" = 0, "completedAt" = NULL, "lastReportAt" = ${now}, "updatedAt" = ${now}
      WHERE ${VIDEO_HAS_PROGRESS} ${progressFilter("p", o)}`;
    return this.same("video_progress", archived, cleared);
  }

  /**
   * Kalit so'zlar progressi: foydalanuvchi × mavzu bo'yicha bitta arxiv yozuvi
   * ("keywords_progress": nechta savolda "Tanishdim", "Tanishib chiqdim" vaqti),
   * keyin KeywordReview va TopicKeywordsView yozuvlari o'chiriladi. Soni tekshiriladi.
   */
  async archiveKeywordsProgress(tx: Prisma.TransactionClient, o: RunOptions, now: Date): Promise<{ keywordReviews: number; keywordViews: number }> {
    const groups = Prisma.sql`
      WITH r AS (
        SELECT k."userId", q."topicId", COUNT(*)::int AS reviewed, MAX(k."createdAt") AS "lastReviewedAt"
        FROM "KeywordReview" k JOIN "Question" q ON q."id" = k."questionId"
        WHERE TRUE ${progressFilter("k", o)}
        GROUP BY 1, 2
      ), v AS (
        SELECT k."userId", k."topicId", k."viewedAt" FROM "TopicKeywordsView" k WHERE TRUE ${progressFilter("k", o)}
      )
      SELECT COALESCE(r."userId", v."userId") AS "userId", COALESCE(r."topicId", v."topicId") AS "topicId",
        COALESCE(r.reviewed, 0) AS reviewed, r."lastReviewedAt", v."viewedAt"
      FROM r FULL OUTER JOIN v ON v."userId" = r."userId" AND v."topicId" = r."topicId"`;
    const [expected] = await tx.$queryRaw<{ groups: bigint; reviews: bigint | null; views: bigint }[]>`
      SELECT COUNT(*) AS groups, SUM(g.reviewed) AS reviews, COUNT(g."viewedAt") AS views FROM (${groups}) g`;
    const archived = await tx.$executeRaw`
      INSERT INTO "WeeklyResultArchive" ("id", "userId", "kind", "sourceId", "weekKey", "data", "sourceCreatedAt", "archivedAt")
      SELECT gen_random_uuid()::text, g."userId", 'keywords_progress', g."userId" || ':' || g."topicId" || ':' || ${o.weekKey}, ${o.weekKey},
        jsonb_build_object('topicSlug', t."slug", 'topicTitle', t."title", 'reviewedQuestions', g.reviewed, 'lastReviewedAt', g."lastReviewedAt", 'viewedAt', g."viewedAt"),
        COALESCE(g."viewedAt", g."lastReviewedAt", ${now}), ${now}
      FROM (${groups}) g JOIN "Topic" t ON t."id" = g."topicId"`;
    this.same("keywords_progress", Number(expected?.groups ?? 0), archived);
    const keywordReviews = await tx.$executeRaw`DELETE FROM "KeywordReview" k WHERE TRUE ${progressFilter("k", o)}`;
    const keywordViews = await tx.$executeRaw`DELETE FROM "TopicKeywordsView" k WHERE TRUE ${progressFilter("k", o)}`;
    this.same("keyword_review", Number(expected?.reviews ?? 0), keywordReviews);
    this.same("keyword_view", Number(expected?.views ?? 0), keywordViews);
    return { keywordReviews, keywordViews };
  }

  /** Yangi oqim (video → kalit so'zlar → test) yoqiladi; bitta foydalanuvchida — sahifasi jonli yangilanishi uchun vaqt ham. */
  async enableFlow(tx: Prisma.TransactionClient, o: RunOptions, now: Date): Promise<number> {
    if (o.userId) {
      const before = await tx.user.findUnique({ where: { id: o.userId }, select: { topicFlowGatingEnabled: true } });
      if (!before) throw new Error("Foydalanuvchi topilmadi");
      await tx.user.update({ where: { id: o.userId }, data: { topicFlowGatingEnabled: true, progressResetAt: now } });
      return before.topicFlowGatingEnabled ? 0 : 1;
    }
    return tx.$executeRaw`
      UPDATE "User" x SET "topicFlowGatingEnabled" = true
      WHERE NOT x."topicFlowGatingEnabled" AND NOT x."weeklyResetExempt"`;
  }

  private same(kind: string, archived: number, cleared: number): number {
    if (archived !== cleared) throw new Error(`${kind}: arxivlangan (${archived}) va nollangan (${cleared}) soni teng emas`);
    return cleared;
  }

  // ── Holat (lenta va jonli yangilash) ──

  async status(user: { id: string; registered: boolean; exempt: boolean } | null, now = new Date()) {
    await this.catchUp(now);
    const weekKey = weekKeyOf(lastResetBoundary(now));
    const [current, last, own] = await Promise.all([
      this.prisma.weeklyReset.findUnique({ where: { weekKey }, select: { status: true } }),
      this.prisma.weeklyReset.findFirst({
        // Exempt foydalanuvchiga faqat "initial-launch" tegadi.
        where: { status: "done", ...GLOBAL_RESET, ...(user?.exempt ? { weekKey: INITIAL_WEEK_KEY } : {}) },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true },
      }),
      // Shu foydalanuvchining alohida nollanishi (admin / tester-reset).
      user ? this.prisma.user.findUnique({ where: { id: user.id }, select: { progressResetAt: true } }) : Promise.resolve(null),
    ]);
    const times = [last?.finishedAt, own?.progressResetAt].filter((d): d is Date => d instanceof Date);
    const lastResetAt = times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null;
    const exempt = Boolean(user?.exempt);
    return {
      serverNow: now.toISOString(),
      nextResetAt: nextResetAt(now).toISOString(),
      bannerFrom: bannerFrom(now).toISOString(),
      // Faqat tizimga kirgan (ro'yxatdan o'tgan) va exempt bo'lmagan foydalanuvchiga.
      bannerVisible: Boolean(user?.registered) && !exempt && isBannerVisible(now, current?.status === "running"),
      lastResetAt: lastResetAt?.toISOString() ?? null,
      exempt,
    };
  }
}
