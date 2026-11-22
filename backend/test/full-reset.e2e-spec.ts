import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService, hashToken } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { FULL_RESET_KEY, lastResetBoundary, nextResetAt, weekKeyOf } from "../src/weekly-reset/schedule";
import { WeeklyResetService } from "../src/weekly-reset/weekly-reset.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// Bir martalik TO'LIQ nollash (hamma, exempt ham; yakuniy imtihon va sertifikatlar
// arxivlanadi), shanba jadvalidagi catch-up himoyalari va tugallangan mavzuda
// video surish (GET /lessons/:id → topicCompleted). Faqat test bazasi.

const iso = (s: string) => new Date(s);
const TOPIC = "full-reset-e2e-topic";
// Darsi bor mavzu (lessons.config) — video + test.
const LESSON = "day4-topic6";

let app: INestApplication;
let prisma: PrismaService;
let service: WeeklyResetService;
let admin: Record<string, string>;
let topicId: string;
let lessonTopicId: string;
let questionId: string;
let optionId: string;
const http = () => request(app.getHttpServer());

async function newUser(firstName: string) {
  const { token } = await app.get(AuthService).createAnonymousSession();
  const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  await prisma.user.update({
    where: { id: session.userId },
    data: { firstName, lastName: "Full", registeredAt: new Date(), paymentStatus: "PAID", accessGrantedAt: new Date() },
  });
  return { auth: { Authorization: `Bearer ${token}` }, userId: session.userId };
}

let certSeq = 0;
/** Haqiqiy format (PI-YYYY-NNNNNN), test uchun 2099-yil. */
const certNo = () => `PI-2099-${String((Date.now() + ++certSeq * 7919) % 1e6).padStart(6, "0")}`;
/** Mavzu testi (o'tilgan), random test, javob, video + kalit so'zlar, yakuniy imtihon (yakunlangan + faol), sertifikat. */
async function seedEverything(userId: string) {
  await prisma.topicTestAttempt.create({ data: { userId, topicId, correct: 10, total: 10, percent: 100 } });
  await prisma.randomTestAttempt.create({
    data: { userId, size: 20, total: 1, status: "finished", deadlineAt: new Date(), finishedAt: new Date(), answered: 1, correct: 1, percent: 100 },
  });
  await prisma.answerLog.create({ data: { userId, questionId, correct: true } });
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId: LESSON } },
    create: { userId, lessonId: LESSON, maxPosition: 206, watchedSeconds: 206, lastPosition: 10, completedAt: new Date(), firstCompletedAt: new Date() },
    update: { maxPosition: 206, watchedSeconds: 206, completedAt: new Date() },
  });
  await prisma.topicKeywordsView.upsert({ where: { userId_topicId: { userId, topicId } }, create: { userId, topicId }, update: {} });
  await prisma.finalExamAttempt.create({
    data: { userId, type: "Q20", status: "FINISHED", expiresAt: new Date(), finishedAt: new Date(), totalQuestions: 20, correctCount: 20, scorePercent: 100, questions: [] },
  });
  await prisma.finalExamAttempt.create({
    data: { userId, type: "Q50", status: "IN_PROGRESS", expiresAt: new Date(Date.now() + 3600_000), totalQuestions: 50, questions: [] },
  });
  return prisma.certificate.create({
    data: {
      userId,
      examType: "Q20",
      fullName: "Test Full",
      averagePercent: 99.5,
      attemptsCount: 10,
      certificateNumber: certNo(),
      letterText: "x",
      letterTone: "perfect",
    },
  });
}

async function live(userId: string) {
  const [topic, random, answers, video, keywords, finals, certs] = await Promise.all([
    prisma.topicTestAttempt.count({ where: { userId, archivedAt: null } }),
    prisma.randomTestAttempt.count({ where: { userId, archivedAt: null, status: { not: "in_progress" } } }),
    prisma.answerLog.count({ where: { userId, archivedAt: null } }),
    prisma.lessonProgress.count({ where: { userId, completedAt: { not: null } } }),
    prisma.topicKeywordsView.count({ where: { userId } }),
    prisma.finalExamAttempt.count({ where: { userId, archivedAt: null } }),
    prisma.certificate.count({ where: { userId, archivedAt: null } }),
  ]);
  return { topic, random, answers, video, keywords, finals, certs };
}

const ZERO_LIVE = { topic: 0, random: 0, answers: 0, video: 0, keywords: 0, finals: 0, certs: 0 };

beforeAll(async () => {
  process.env.PAYMENT_ENFORCED = "false";
  delete process.env.INITIAL_RESET_ON_DEPLOY;
  delete process.env.TESTER_RESET_ON_DEPLOY;
  await configureAdminEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  service = app.get(WeeklyResetService);
  await createTestAdmin(prisma, "e2e-fullreset", "Full-Reset-2026-x");
  admin = await adminHeaders(app, "e2e-fullreset", "Full-Reset-2026-x", "10.44.0.1");
  // Toza holat (faqat test bazasi): yangilanishlar, arxiv, boshqa testlardan qolgan progress.
  await prisma.weeklyResultArchive.deleteMany({});
  await prisma.weeklyReset.deleteMany({});
  await prisma.auditLog.deleteMany({ where: { action: "results.full_reset" } });
  await prisma.lessonProgress.deleteMany({});
  await prisma.topic.deleteMany({ where: { slug: { in: [TOPIC, LESSON] } } });
  const topic = await prisma.topic.create({ data: { slug: TOPIC, title: "To'liq nollash mavzusi", kind: "collection" } });
  topicId = topic.id;
  const q = await prisma.question.create({
    data: { topicId, order: 1, text: "Савол", keyword: "", options: { create: [{ order: 1, text: "А", isCorrect: true }, { order: 2, text: "Б" }] } },
    include: { options: true },
  });
  questionId = q.id;
  optionId = q.options[0].id;
  const lessonTopic = await prisma.topic.create({ data: { slug: LESSON, title: LESSON } });
  lessonTopicId = lessonTopic.id;
  await prisma.question.create({
    data: { topicId: lessonTopicId, order: 1, text: "Савол", keyword: "", options: { create: [{ order: 1, text: "А", isCorrect: true }, { order: 2, text: "Б" }] } },
  });
}, 60_000);

afterAll(async () => {
  await prisma?.lessonProgress.deleteMany({ where: { lessonId: LESSON } });
  await prisma?.topic.deleteMany({ where: { slug: { in: [TOPIC, LESSON] } } });
  await prisma?.admin.deleteMany({ where: { login: "e2e-fullreset" } });
  await app?.close();
});

describe("Bir martalik to'liq nollash", () => {
  let ali: Awaited<ReturnType<typeof newUser>>;
  let umar: Awaited<ReturnType<typeof newUser>>;
  let aliCert: { id: string; certificateNumber: string };

  it("dryRun: sanaydi (exempt ham, yakuniy imtihon va sertifikat ham), hech narsa yozmaydi", async () => {
    ali = await newUser("Ali");
    umar = await newUser("Umar");
    await prisma.user.update({ where: { id: umar.userId }, data: { weeklyResetExempt: true } });
    aliCert = await seedEverything(ali.userId);
    await seedEverything(umar.userId);
    const before = { ali: await live(ali.userId), umar: await live(umar.userId) };
    expect(before.umar).toMatchObject({ topic: 1, video: 1, finals: 2, certs: 1 });

    const dry = await service.fullReset({ dryRun: true });
    expect(dry).toMatchObject({ dryRun: true, skipped: false, weekKey: FULL_RESET_KEY });
    expect(dry.affectedUsers).toBeGreaterThanOrEqual(2);
    // Test bazasida boshqa fayllardan qolgan yozuvlar ham bo'lishi mumkin — kamida shu ikkalasiniki.
    for (const [k, min] of Object.entries({ topicTests: 2, randomTests: 2, finalExams: 4, certificates: 2, videoProgress: 2, keywordViews: 2 })) {
      expect(dry.counts[k as keyof typeof dry.counts]).toBeGreaterThanOrEqual(min);
    }
    expect({ ali: await live(ali.userId), umar: await live(umar.userId) }).toEqual(before);
    expect(await prisma.weeklyReset.count()).toBe(0);
    expect(await prisma.weeklyResultArchive.count()).toBe(0);

    // Admin endpoint: tasdiq iborasisiz 400, dryRun — o'zgarishsiz.
    await http().post("/admin/weekly-resets/full").send({ confirm: "HAMMASINI NOLLASH", dryRun: true }).expect(403);
    await http().post("/admin/weekly-resets/full").set(admin).send({ dryRun: true }).expect(400);
    await http().post("/admin/weekly-resets/full").set(admin).send({ confirm: "YANGILASH" }).expect(400);
    const apiDry = (await http().post("/admin/weekly-resets/full").set(admin).send({ confirm: "HAMMASINI NOLLASH", dryRun: true }).expect(200)).body;
    expect(apiDry).toMatchObject({ dryRun: true, previous: null });
    expect(await prisma.weeklyReset.count()).toBe(0);
  });

  it("bajarish: hamma (exempt Umar ham) nolga tushadi; arxivda hammasi bor; sertifikat o'chirilmaydi", async () => {
    const res = (await http().post("/admin/weekly-resets/full").set(admin).send({ confirm: "HAMMASINI NOLLASH" }).expect(200)).body;
    expect(res).toMatchObject({ skipped: false, dryRun: false, weekKey: FULL_RESET_KEY });
    expect(await prisma.auditLog.count({ where: { action: "results.full_reset", entityId: FULL_RESET_KEY } })).toBe(1);
    expect(await live(ali.userId)).toEqual(ZERO_LIVE);
    expect(await live(umar.userId)).toEqual(ZERO_LIVE);

    // Faol yakuniy imtihon yopilgan va arxivlangan; sertifikat joyida, faqat arxivlangan.
    expect(await prisma.finalExamAttempt.count({ where: { userId: ali.userId, status: "IN_PROGRESS" } })).toBe(0);
    const cert = await prisma.certificate.findUniqueOrThrow({ where: { id: aliCert.id } });
    expect(cert.archivedAt).not.toBeNull();
    expect(cert.archiveWeekKey).toBe(FULL_RESET_KEY);

    // Arxiv: har tur soni nollangan soniga teng.
    const counts = res.counts as Record<string, number>;
    const archived = await prisma.weeklyResultArchive.groupBy({ by: ["kind"], where: { weekKey: FULL_RESET_KEY }, _count: { _all: true } });
    const byKind = Object.fromEntries(archived.map((a) => [a.kind, a._count._all]));
    expect(byKind).toMatchObject({ topic_test: counts.topicTests, random_test: counts.randomTests, final_exam: counts.finalExams, certificate: counts.certificates });
    expect(byKind.video_progress).toBe(counts.videoProgress);
    // Oqim hammada (exempt ham) yoqilgan.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: umar.userId } })).topicFlowGatingEnabled).toBe(true);
  });

  it("idempotent: ikkinchi chaqiruv hech narsa qilmaydi", async () => {
    await prisma.topicTestAttempt.create({ data: { userId: ali.userId, topicId, correct: 10, total: 10, percent: 100 } });
    const again = await service.fullReset({ dryRun: false });
    expect(again.skipped).toBe(true);
    const api = (await http().post("/admin/weekly-resets/full").set(admin).send({ confirm: "HAMMASINI NOLLASH" }).expect(200)).body;
    expect(api.skipped).toBe(true);
    expect((await live(ali.userId)).topic).toBe(1);
    expect(await prisma.weeklyReset.count({ where: { weekKey: FULL_RESET_KEY } })).toBe(1);
    // dryRun oldingi holatni ko'rsatadi.
    const dry = (await http().post("/admin/weekly-resets/full").set(admin).send({ confirm: "HAMMASINI NOLLASH", dryRun: true }).expect(200)).body;
    expect(dry.previous).toMatchObject({ status: "done" });
    await prisma.topicTestAttempt.deleteMany({ where: { userId: ali.userId, archivedAt: null } });
  });

  it("kabinet: sertifikatlar ro'yxati bo'sh, imtihon urinishlari 0; ketma-ketlik boshidan (passed-before bo'sh)", async () => {
    expect((await http().get("/certificates").set(ali.auth).expect(200)).body).toEqual([]);
    await http().get(`/certificates/${aliCert.certificateNumber}`).set(ali.auth).expect(404);
    const overview = (await http().get("/final-exam").set(ali.auth).expect(200)).body;
    for (const t of overview.types) expect(t).toMatchObject({ attemptsUsed: 0, average: null, certificate: null });
    expect((await http().get("/attempts").set(ali.auth).expect(200)).body).toEqual([]);
    expect((await http().get("/attempts/passed-before").set(ali.auth).expect(200)).body).toEqual([]);
    expect((await http().get("/random-tests").set(ali.auth).expect(200)).body.history).toEqual([]);
    // Sertifikat raqami bo'yicha ommaviy tekshiruv ishlayveradi (sertifikat haqiqatan berilgan).
    await http().get(`/public/certificates/${aliCert.certificateNumber}`).expect(200);
  });

  it("admin: arxivda yakuniy imtihon va sertifikat ko'rinadi; nollashdan keyin yangi sertifikat berilishi mumkin", async () => {
    const detail = (await http().get(`/admin/users/${ali.userId}/results-archive/${FULL_RESET_KEY}`).set(admin).expect(200)).body;
    expect(detail.finalExams).toHaveLength(2);
    expect(detail.certificates).toHaveLength(1);
    expect(detail.certificates[0]).toMatchObject({ certificateNumber: aliCert.certificateNumber, examType: "Q20" });
    const weeks = (await http().get(`/admin/users/${ali.userId}/results-archive`).set(admin).expect(200)).body;
    expect(weeks.weeks.some((w: { weekKey: string }) => w.weekKey === FULL_RESET_KEY)).toBe(true);
    const exam = (await http().get(`/admin/final-exam/users/${ali.userId}`).set(admin).expect(200)).body;
    const q20 = exam.types.find((t: { type: string }) => t.type === "Q20");
    expect(q20).toMatchObject({ attemptsUsed: 0, certificate: null, archivedCount: 1 });
    expect(q20.archivedCertificates).toHaveLength(1);

    // Faqat FAOL sertifikat unikal: arxivlangandan keyin shu tur uchun yangisi yaratiladi, ikkinchi faol — yo'q.
    const fresh = { userId: ali.userId, examType: "Q20" as const, averagePercent: 99, attemptsCount: 10, letterText: "y", letterTone: "steady" };
    await prisma.certificate.create({ data: { ...fresh, certificateNumber: certNo() } });
    await expect(prisma.certificate.create({ data: { ...fresh, certificateNumber: certNo() } })).rejects.toMatchObject({ code: "P2002" });
    await prisma.certificate.deleteMany({ where: { userId: ali.userId, archivedAt: null } });
  });

  it("haftalik: exempt (Umar) o'tkazib yuboriladi, boshqalar nollanadi", async () => {
    await prisma.topicTestAttempt.create({ data: { userId: ali.userId, topicId, correct: 10, total: 10, percent: 100 } });
    await prisma.topicTestAttempt.create({ data: { userId: umar.userId, topicId, correct: 10, total: 10, percent: 100 } });
    const at = new Date(nextResetAt(new Date()).getTime() + 60_000);
    const res = await service.runWeekly("cron", at);
    expect(res.skipped).toBe(false);
    expect(res.counts.finalExams).toBe(0);
    expect((await live(ali.userId)).topic).toBe(0);
    expect((await live(umar.userId)).topic).toBe(1);
    // Exempt foydalanuvchining "oxirgi yangilanish" vaqti to'liq nollashni ham hisobga oladi.
    const status = (await http().get("/meta/reset-status").set(umar.auth).expect(200)).body;
    expect(status).toMatchObject({ exempt: true, bannerVisible: false });
    expect(status.lastResetAt).not.toBeNull();
  });
});

describe("Shanba jadvali: catch-up ortiqcha nollamaydi", () => {
  it("jadval kuchga kirgunga qadar (2026-11-21 shanba) — hech narsa", async () => {
    const before = await prisma.weeklyReset.count();
    const res = await service.runWeekly("catchup", iso("2026-11-22T07:00:00Z"));
    expect(res.skipped).toBe(true);
    await service.catchUp(iso("2026-11-23T18:00:00Z")); // eski jadvaldagi dushanba 22:00 dan keyin ham
    expect(await prisma.weeklyReset.count()).toBe(before);
  });

  it("chegaradan keyin qo'lda/to'liq nollash bo'lgan bo'lsa — hafta 'covered', qayta nollanmaydi", async () => {
    const boundary = iso("2026-12-05T17:00:00Z");
    const weekKey = weekKeyOf(boundary);
    await prisma.weeklyReset.create({
      data: { weekKey: "manual-e2e-after-boundary", status: "done", triggeredBy: "manual", startedAt: iso("2026-12-05T18:00:00Z"), finishedAt: iso("2026-12-05T18:01:00Z") },
    });
    const u = await newUser("Catchup");
    await prisma.topicTestAttempt.create({ data: { userId: u.userId, topicId, correct: 10, total: 10, percent: 100 } });
    const res = await service.runWeekly("catchup", iso("2026-12-06T05:00:00Z"));
    expect(res.skipped).toBe(true);
    expect((await prisma.weeklyReset.findUniqueOrThrow({ where: { weekKey } })).status).toBe("covered");
    expect((await live(u.userId)).topic).toBe(1);
    // Keyingi shanba — odatdagidek bajariladi.
    const next = await service.runWeekly("cron", iso("2026-12-12T17:01:00Z"));
    expect(next).toMatchObject({ skipped: false, weekKey: weekKeyOf(lastResetBoundary(iso("2026-12-12T17:01:00Z"))) });
    expect((await live(u.userId)).topic).toBe(0);
  });
});

describe("Tugallangan mavzuda video surish (server holati)", () => {
  it("faqat video ko'rilgan — topicCompleted false; test o'tilgach — true; qayta ko'rish progressni o'zgartirmaydi; nollashdan keyin — false", async () => {
    const u = await newUser("Video");
    // Ko'rilmagan dars.
    let status = (await http().get(`/lessons/${LESSON}`).set(u.auth).expect(200)).body;
    expect(status).toMatchObject({ completed: false, topicCompleted: false });

    // Video ko'rilgan, test o'tilmagan — cheklov qoladi.
    const watchedAt = new Date(Date.now() - 3600_000);
    await prisma.lessonProgress.create({
      data: { userId: u.userId, lessonId: LESSON, maxPosition: 206, watchedSeconds: 206, lastPosition: 0, completedAt: watchedAt, firstCompletedAt: watchedAt },
    });
    status = (await http().get(`/lessons/${LESSON}`).set(u.auth).expect(200)).body;
    expect(status).toMatchObject({ completed: true, topicCompleted: false });
    await prisma.topicTestAttempt.create({ data: { userId: u.userId, topicId: lessonTopicId, correct: 9, total: 10, percent: 90 } });
    expect((await http().get(`/lessons/${LESSON}`).set(u.auth).expect(200)).body.topicCompleted).toBe(false);

    // Test o'tilgan — mavzu tugallangan.
    await prisma.topicTestAttempt.create({ data: { userId: u.userId, topicId: lessonTopicId, correct: 10, total: 10, percent: 100 } });
    status = (await http().get(`/lessons/${LESSON}`).set(u.auth).expect(200)).body;
    expect(status.topicCompleted).toBe(true);
    const list = (await http().get("/lessons").set(u.auth).expect(200)).body as { lessonId: string; topicCompleted: boolean }[];
    expect(list.find((l) => l.lessonId === LESSON)?.topicCompleted).toBe(true);
    expect(list.filter((l) => l.topicCompleted)).toHaveLength(1);

    // Qayta ko'rishda oldinga surib hisobot — faqat davom ettirish nuqtasi o'zgaradi.
    const rowBefore = await prisma.lessonProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId: u.userId, lessonId: LESSON } } });
    const report = (await http().post(`/lessons/${LESSON}/progress`).set(u.auth).send({ position: 150, maxPosition: 206, watchedDelta: 500 }).expect(200)).body;
    expect(report).toMatchObject({ completed: true, topicCompleted: true, position: 150 });
    const rowAfter = await prisma.lessonProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId: u.userId, lessonId: LESSON } } });
    expect(rowAfter).toMatchObject({
      watchedSeconds: rowBefore.watchedSeconds,
      maxPosition: rowBefore.maxPosition,
      completedAt: rowBefore.completedAt,
      firstCompletedAt: rowBefore.firstCompletedAt,
      lastPosition: 150,
    });
    expect(await prisma.topicTestAttempt.count({ where: { userId: u.userId, archivedAt: null } })).toBe(2);

    // Foydalanuvchi nollangach — cheklov qaytadi.
    await service.resetUser(u.userId, "e2e", false);
    status = (await http().get(`/lessons/${LESSON}`).set(u.auth).expect(200)).body;
    expect(status).toMatchObject({ completed: false, topicCompleted: false });
  });

  it("tugallanmagan mavzuda oldinga sakrash serverda hisoblanmaydi (klient bayrog'iga bog'liq emas)", async () => {
    const u = await newUser("Skip");
    const res = (await http().post(`/lessons/${LESSON}/progress`).set(u.auth).send({ position: 200, maxPosition: 206, watchedDelta: 206 }).expect(200)).body;
    expect(res.completed).toBe(false);
    expect(res.topicCompleted).toBe(false);
    expect(res.maxPosition).toBeLessThan(206);
  });
});
