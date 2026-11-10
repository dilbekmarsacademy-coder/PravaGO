import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService, hashToken } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { INITIAL_WEEK_KEY, isBannerVisible, lastResetBoundary, nextResetAt, weekKeyOf } from "../src/weekly-reset/schedule";
import { WeeklyResetService } from "../src/weekly-reset/weekly-reset.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// Haftalik natijalar yangilanishi: jadval (Asia/Tashkent), arxivlash + nollash,
// idempotentlik, exempt ("Umar"), initial-launch, tranzaksiya va admin arxivi.
// Faqat test bazasi — production'da hech narsa ishga tushmaydi.

const iso = (s: string) => new Date(s);

describe("Haftalik yangilanish — jadval (Asia/Tashkent, UTC+5)", () => {
  it("keyingi yangilanish: dushanba 22:00", () => {
    // 2026-11-08 yakshanba 23:30 Toshkent → ertaga (dushanba) 22:00.
    expect(nextResetAt(iso("2026-11-08T18:30:00Z")).toISOString()).toBe("2026-11-09T17:00:00.000Z");
    // Dushanba 21:59 → shu kuni 22:00.
    expect(nextResetAt(iso("2026-11-09T16:59:00Z")).toISOString()).toBe("2026-11-09T17:00:00.000Z");
    // Dushanba 22:01 → keyingi dushanba.
    expect(nextResetAt(iso("2026-11-09T17:01:00Z")).toISOString()).toBe("2026-11-16T17:00:00.000Z");
    expect(lastResetBoundary(iso("2026-11-09T17:01:00Z")).toISOString()).toBe("2026-11-09T17:00:00.000Z");
    // Oy almashuvi: 2026-11-30 dushanba.
    expect(nextResetAt(iso("2026-11-28T10:00:00Z")).toISOString()).toBe("2026-11-30T17:00:00.000Z");
    // Yil almashuvi: 2026-12-31 → 2027-01-04 dushanba.
    expect(nextResetAt(iso("2026-12-31T19:00:00Z")).toISOString()).toBe("2027-01-04T17:00:00.000Z");
    // UTC bo'yicha hali yakshanba, Toshkentda esa dushanba 00:30.
    expect(nextResetAt(iso("2026-11-08T19:30:00Z")).toISOString()).toBe("2026-11-09T17:00:00.000Z");
  });

  it("hafta kaliti (ISO)", () => {
    expect(weekKeyOf(iso("2026-11-09T17:00:00Z"))).toBe("2026-W46");
    expect(weekKeyOf(iso("2026-12-28T17:00:00Z"))).toBe("2026-W53");
    expect(weekKeyOf(iso("2027-01-04T17:00:00Z"))).toBe("2027-W01");
  });

  it("lenta: dushanba 12:00 dan 22:00 gacha", () => {
    expect(isBannerVisible(iso("2026-11-09T06:59:00Z"), false)).toBe(false); // 11:59
    expect(isBannerVisible(iso("2026-11-09T07:00:00Z"), false)).toBe(true); // 12:00
    expect(isBannerVisible(iso("2026-11-09T16:59:59Z"), false)).toBe(true); // 21:59:59
    expect(isBannerVisible(iso("2026-11-09T17:00:00Z"), false)).toBe(false); // 22:00, bajarilgan
    expect(isBannerVisible(iso("2026-11-09T17:30:00Z"), true)).toBe(true); // hali bajarilyapti
    expect(isBannerVisible(iso("2026-11-10T07:00:00Z"), false)).toBe(false); // seshanba
  });
});

let app: INestApplication;
let prisma: PrismaService;
let service: WeeklyResetService;
let admin: Record<string, string>;
let topicId: string;
let questionId: string;
let optionId: string;
const http = () => request(app.getHttpServer());

async function newUser(firstName: string, registered = true) {
  const { token } = await app.get(AuthService).createAnonymousSession();
  const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  await prisma.user.update({ where: { id: session.userId }, data: { firstName, lastName: "Test", ...(registered ? { registeredAt: new Date() } : {}) } });
  return { auth: { Authorization: `Bearer ${token}` }, userId: session.userId };
}

/** Natijalar: 2 ta mavzu testi, tugallangan va tugallanmagan random test, javoblar logi, AI xulosa. */
async function seedResults(userId: string) {
  await prisma.topicTestAttempt.createMany({
    data: [
      { userId, topicId, correct: 9, total: 10, percent: 90 },
      { userId, topicId, correct: 10, total: 10, percent: 100 },
    ],
  });
  const finished = await prisma.randomTestAttempt.create({
    data: { userId, size: 20, total: 1, status: "finished", deadlineAt: new Date(), finishedAt: new Date(), answered: 1, correct: 1, percent: 100 },
  });
  await prisma.randomTestAnswer.create({ data: { attemptId: finished.id, questionId, position: 0, optionOrder: [optionId], selectedOptionId: optionId, correct: true, answeredAt: new Date() } });
  await prisma.answerLog.createMany({ data: [{ userId, questionId, correct: true }, { userId, questionId, correct: false }] });
  await prisma.aiStudentInsight.upsert({ where: { userId }, create: { userId, locale: "uz-latn", content: { summary: "x", tips: [] } }, update: {} });
}

async function liveCounts(userId: string) {
  const [topic, random, answers, insight] = await Promise.all([
    prisma.topicTestAttempt.count({ where: { userId, archivedAt: null } }),
    prisma.randomTestAttempt.count({ where: { userId, archivedAt: null, status: { not: "in_progress" } } }),
    prisma.answerLog.count({ where: { userId, archivedAt: null } }),
    prisma.aiStudentInsight.count({ where: { userId } }),
  ]);
  return { topic, random, answers, insight };
}

beforeAll(async () => {
  process.env.PAYMENT_ENFORCED = "false";
  delete process.env.INITIAL_RESET_ON_DEPLOY;
  await configureAdminEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  service = app.get(WeeklyResetService);
  await createTestAdmin(prisma, "e2e-weekly", "Weekly-Reset-2026");
  admin = await adminHeaders(app, "e2e-weekly", "Weekly-Reset-2026");
  // Toza holat: avvalgi yangilanishlar va arxiv (faqat test bazasi).
  await prisma.weeklyResultArchive.deleteMany({});
  await prisma.weeklyReset.deleteMany({});
  await prisma.topic.deleteMany({ where: { slug: "weekly-e2e-topic" } });
  const topic = await prisma.topic.create({ data: { slug: "weekly-e2e-topic", title: "Haftalik test mavzusi", kind: "collection" } });
  topicId = topic.id;
  const q = await prisma.question.create({ data: { topicId, order: 1, text: "Савол", keyword: "", options: { create: [{ order: 1, text: "А", isCorrect: true }, { order: 2, text: "Б" }] } }, include: { options: true } });
  questionId = q.id;
  optionId = q.options[0].id;
}, 60_000);

afterAll(async () => {
  await prisma?.topic.deleteMany({ where: { slug: "weekly-e2e-topic" } });
  await app?.close();
});

describe("Haftalik yangilanish — arxivlash va nollash", () => {
  let user: Awaited<ReturnType<typeof newUser>>;
  let umar: Awaited<ReturnType<typeof newUser>>;

  it("dryRun hech narsani o'zgartirmaydi", async () => {
    user = await newUser("Ali");
    umar = await newUser("Umar");
    await prisma.user.update({ where: { id: umar.userId }, data: { weeklyResetExempt: true } });
    await seedResults(user.userId);
    await seedResults(umar.userId);
    const before = await liveCounts(user.userId);
    const res = await service.run({ weekKey: "dry-e2e", triggeredBy: "manual", includeExempt: false, dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(res.counts.topicTests).toBeGreaterThanOrEqual(2);
    expect(await liveCounts(user.userId)).toEqual(before);
    expect(await prisma.weeklyReset.count()).toBe(0);
    expect(await prisma.weeklyResultArchive.count()).toBe(0);
  });

  it("initial-launch: flag o'chiq bo'lsa ishlamaydi", async () => {
    await service.onApplicationBootstrap();
    expect(await prisma.weeklyReset.count()).toBe(0);
    // Tizim hali ishga tushmagan — catch-up ham hech narsa qilmaydi.
    await http().get("/meta/reset-status").set(user.auth).expect(200);
    expect(await prisma.weeklyReset.count()).toBe(0);
  });

  it("initial-launch: hamma (Umar ham) nolga tushadi, faqat bir marta; joriy hafta qoplangan", async () => {
    // Faol random test va yakuniy imtihon / sertifikat — tegilmasligi kerak.
    const active = await prisma.randomTestAttempt.create({ data: { userId: user.userId, size: 20, total: 1, status: "in_progress", deadlineAt: new Date(Date.now() + 3600_000) } });
    const final = await prisma.finalExamAttempt.create({
      data: { userId: user.userId, type: "Q20", status: "FINISHED", expiresAt: new Date(), finishedAt: new Date(), totalQuestions: 20, correctCount: 20, scorePercent: 100, questions: [] },
    });
    const cert = await prisma.certificate.create({ data: { userId: user.userId, examType: "Q20", fullName: "Ali Test", averagePercent: 100, attemptsCount: 10, certificateNumber: `PI-E2E-${Date.now() % 1e9}`, letterText: "x", letterTone: "perfect" } });
    await prisma.user.update({ where: { id: user.userId }, data: { paymentStatus: "PAID", accessGrantedAt: new Date() } });

    process.env.INITIAL_RESET_ON_DEPLOY = "true";
    await service.onApplicationBootstrap();
    const initial = await prisma.weeklyReset.findUniqueOrThrow({ where: { weekKey: INITIAL_WEEK_KEY } });
    expect(initial).toMatchObject({ status: "done", triggeredBy: "initial" });
    expect(await liveCounts(user.userId)).toEqual({ topic: 0, random: 0, answers: 0, insight: 0 });
    expect(await liveCounts(umar.userId)).toEqual({ topic: 0, random: 0, answers: 0, insight: 0 });

    // Arxiv yozuvlari soni = nollangan yozuvlar soni.
    const counts = initial.counts as Record<string, number>;
    const archived = await prisma.weeklyResultArchive.groupBy({ by: ["kind"], where: { weekKey: INITIAL_WEEK_KEY }, _count: { _all: true } });
    const byKind = Object.fromEntries(archived.map((a) => [a.kind, a._count._all]));
    expect(byKind).toEqual({ topic_test: counts.topicTests, random_test: counts.randomTests, answer: counts.answers, ai_insight: counts.aiInsights });
    expect(await prisma.topicTestAttempt.count({ where: { archiveWeekKey: INITIAL_WEEK_KEY } })).toBe(counts.topicTests);

    // Tegilmaydi: faol random test, yakuniy imtihon, sertifikat, to'lov.
    expect((await prisma.randomTestAttempt.findUniqueOrThrow({ where: { id: active.id } })).archivedAt).toBeNull();
    expect(await prisma.finalExamAttempt.findUnique({ where: { id: final.id } })).not.toBeNull();
    expect(await prisma.certificate.findUnique({ where: { id: cert.id } })).not.toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.userId } })).paymentStatus).toBe("PAID");

    // Joriy hafta "covered" — catch-up uni qayta bajarmaydi.
    const weekKey = weekKeyOf(lastResetBoundary(new Date()));
    expect((await prisma.weeklyReset.findUniqueOrThrow({ where: { weekKey } })).status).toBe("covered");
    const rows = await prisma.weeklyReset.count();
    await service.catchUp();
    await http().get("/meta/reset-status").set(user.auth).expect(200);
    expect(await prisma.weeklyReset.count()).toBe(rows);

    // Qayta ishga tushirish (yangi deploy, flag hali true) — qaytarilmaydi.
    const archiveTotal = await prisma.weeklyResultArchive.count();
    await service.onApplicationBootstrap();
    expect(await prisma.weeklyResultArchive.count()).toBe(archiveTotal);
    expect((await prisma.weeklyReset.findUniqueOrThrow({ where: { weekKey: INITIAL_WEEK_KEY } })).finishedAt).toEqual(initial.finishedAt);
    delete process.env.INITIAL_RESET_ON_DEPLOY;
    await prisma.randomTestAttempt.delete({ where: { id: active.id } });
  });

  it("foydalanuvchi API'lari 0 natija qaytaradi va arxivni ko'rsatmaydi", async () => {
    expect((await http().get("/attempts").set(user.auth).expect(200)).body).toEqual([]);
    // Qulf yopilmasin: o'tilgan mavzular faqat slug sifatida (natijalarsiz).
    expect((await http().get("/attempts/passed-before").set(user.auth).expect(200)).body).toEqual(["weekly-e2e-topic"]);
    const random = (await http().get("/random-tests").set(user.auth).expect(200)).body;
    expect(random.history).toEqual([]);
    const archivedRandom = await prisma.randomTestAttempt.findFirstOrThrow({ where: { userId: user.userId, archivedAt: { not: null } } });
    await http().get(`/random-tests/${archivedRandom.id}`).set(user.auth).expect(404);
    const insight = (await http().get("/me/insight").set(user.auth).expect(200)).body;
    expect(insight.insight).toBeNull();
    expect(JSON.stringify(insight)).not.toMatch(/archive|weekKey/i);
    const status = (await http().get("/meta/reset-status").set(user.auth).expect(200)).body;
    expect(status).toMatchObject({ exempt: false });
    expect(status.lastResetAt).not.toBeNull();
    expect(Object.keys(status).sort()).toEqual(["bannerFrom", "bannerVisible", "exempt", "lastResetAt", "nextResetAt", "serverNow"]);
  });

  it("haftalik: Umar (exempt) nolga tushmaydi, boshqalar tushadi; bir hafta — bir marta", async () => {
    await seedResults(user.userId);
    await seedResults(umar.userId);
    const nextWeek = new Date(nextResetAt(new Date()).getTime() + 60_000);
    const res = await service.runWeekly("cron", nextWeek);
    expect(res.skipped).toBe(false);
    expect(res.weekKey).toBe(weekKeyOf(lastResetBoundary(nextWeek)));
    expect(await liveCounts(user.userId)).toEqual({ topic: 0, random: 0, answers: 0, insight: 0 });
    expect(await liveCounts(umar.userId)).toEqual({ topic: 2, random: 1, answers: 2, insight: 1 });
    expect(await prisma.weeklyResultArchive.count({ where: { userId: umar.userId, weekKey: res.weekKey } })).toBe(0);
    // Idempotent: shu hafta qayta — o'tkazib yuboriladi.
    const again = await service.runWeekly("catchup", nextWeek);
    expect(again.skipped).toBe(true);
    expect(await prisma.weeklyReset.count({ where: { weekKey: res.weekKey } })).toBe(1);
    // Exempt foydalanuvchining "oxirgi yangilanish" vaqti faqat initial-launch.
    const status = (await http().get("/meta/reset-status").set(umar.auth).expect(200)).body;
    expect(status).toMatchObject({ exempt: true, bannerVisible: false });
  });

  it("arxivlash xatosida nollash bajarilmaydi (bitta tranzaksiya)", async () => {
    await seedResults(user.userId);
    const spy = vi.spyOn(service, "archiveRandomTests").mockRejectedValueOnce(new Error("arxiv xatosi"));
    await expect(service.run({ weekKey: "tx-fail-e2e", triggeredBy: "manual", includeExempt: false })).rejects.toThrow("arxiv xatosi");
    spy.mockRestore();
    // Mavzu testlari arxivi ham qaytarilgan.
    expect(await liveCounts(user.userId)).toMatchObject({ topic: 2, random: 1, answers: 2 });
    expect(await prisma.weeklyResultArchive.count({ where: { weekKey: "tx-fail-e2e" } })).toBe(0);
    expect((await prisma.weeklyReset.findUniqueOrThrow({ where: { weekKey: "tx-fail-e2e" } })).status).toBe("failed");
    // "failed" — qayta urinish mumkin.
    const retry = await service.run({ weekKey: "tx-fail-e2e", triggeredBy: "manual", includeExempt: false });
    expect(retry.skipped).toBe(false);
    expect(await liveCounts(user.userId)).toEqual({ topic: 0, random: 0, answers: 0, insight: 0 });
  });
});

describe("Haftalik yangilanish — admin", () => {
  it("arxiv haftalar bo'yicha, batafsil; tumbler; Hozir yangilash tasdiqsiz ishlamaydi", async () => {
    const u = await newUser("Arxiv");
    await seedResults(u.userId);
    await http().get(`/admin/users/${u.userId}/results-archive`).expect(403);
    let weeks = (await http().get(`/admin/users/${u.userId}/results-archive`).set(admin).expect(200)).body;
    expect(weeks.current).toMatchObject({ weekKey: "current", tests: 3, topicTests: 2, randomTests: 1, correct: 20, wrong: 1 });

    // Tasdiqsiz — 400; noto'g'ri so'z — 400; dryRun — hech narsa o'zgarmaydi.
    await http().post("/admin/weekly-resets/run").set(admin).send({}).expect(400);
    await http().post("/admin/weekly-resets/run").set(admin).send({ confirm: "yangilash" }).expect(400);
    const dry = (await http().post("/admin/weekly-resets/run").set(admin).send({ confirm: "YANGILASH", dryRun: true }).expect(200)).body;
    expect(dry.dryRun).toBe(true);
    expect((await liveCounts(u.userId)).topic).toBe(2);

    const run = (await http().post("/admin/weekly-resets/run").set(admin).send({ confirm: "YANGILASH" }).expect(200)).body;
    expect(run.weekKey).toMatch(/^manual-/);
    expect(await prisma.auditLog.count({ where: { action: "results.weekly_reset", entityId: run.weekKey } })).toBe(1);
    expect((await liveCounts(u.userId)).topic).toBe(0);

    weeks = (await http().get(`/admin/users/${u.userId}/results-archive`).set(admin).expect(200)).body;
    expect(weeks.current.tests).toBe(0);
    expect(weeks.weeks[0]).toMatchObject({ weekKey: run.weekKey, tests: 3, averagePercent: 96.7 });
    const detail = (await http().get(`/admin/users/${u.userId}/results-archive/${run.weekKey}`).set(admin).expect(200)).body;
    expect(detail.topicTests).toHaveLength(2);
    expect(detail.topicTests[0]).toMatchObject({ topicSlug: "weekly-e2e-topic" });
    expect(detail.randomTests).toHaveLength(1);

    const list = (await http().get("/admin/weekly-resets").set(admin).expect(200)).body;
    expect(list.lastResetAt).not.toBeNull();
    expect(list.items.some((r: { weekKey: string }) => r.weekKey === run.weekKey)).toBe(true);
    const byUser = (await http().get(`/admin/weekly-resets/${run.weekKey}/users?q=Arxiv`).set(admin).expect(200)).body;
    expect(byUser.items[0]).toMatchObject({ user: { id: u.userId }, tests: 3 });

    // Tumbler.
    expect((await http().post(`/admin/users/${u.userId}/weekly-reset-exempt`).set(admin).send({ enabled: true }).expect(200)).body).toMatchObject({ weeklyResetExempt: true });
    expect(await prisma.auditLog.count({ where: { action: "user.weekly_reset_exempt", entityId: u.userId } })).toBe(1);
  });
});
