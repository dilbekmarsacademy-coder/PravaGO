import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService, hashToken } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { LESSONS, type LessonConfig } from "../src/lessons/lessons.config";
import { FinalExamService } from "../src/final-exam/final-exam.service";
import { TESTER_WEEK_KEY, WeeklyResetService } from "../src/weekly-reset/weekly-reset.service";
import { lastResetBoundary, weekKeyOf } from "../src/weekly-reset/schedule";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";
import { reviewAllKeywords } from "./helpers/keywords";

// 1) Admin: kun mavzusi savolini yumshoq o'chirish (faqat admin, audit, hamma
//    o'quvchi joylaridan chiqadi, boshlangan urinishlar va eski natijalar buzilmaydi).
// 2) Kunlik mavzu oqimi: video → "Tanishib chiqdim" → test (topicFlowGatingEnabled,
//    server tomonida); bayroq o'chiq bo'lsa — eski qoida.
// 3) Haftalik yangilanish video va kalit so'zlar progressini arxivlab nollaydi,
//    bayroqni yoqadi; exempt'ga tegmaydi; "tester-reset" va admin nollashi.
// Faqat test bazasi.

const SLUG = "day6-topic91";
const LESSON_MAP = LESSONS as Record<string, LessonConfig>;
const ADMIN = "e2e-qdel";
const PASSWORD = "Question-Delete-2026";

let app: INestApplication;
let prisma: PrismaService;
let reset: WeeklyResetService;
let admin: Record<string, string>;
let topicId: string;
const questions: { id: string; correct: string; wrong: string }[] = [];
const http = () => request(app.getHttpServer());

async function newUser(data: { firstName?: string; gated?: boolean; unlockAll?: boolean } = {}) {
  const { token } = await app.get(AuthService).createAnonymousSession();
  const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  await prisma.user.update({
    where: { id: session.userId },
    data: {
      firstName: data.firstName ?? "Flow",
      lastName: "E2e",
      registeredAt: new Date(),
      ...(data.gated === undefined ? {} : { topicFlowGatingEnabled: data.gated }),
      ...(data.unlockAll ? { unlockAll: true } : {}),
    },
  });
  return { auth: { Authorization: `Bearer ${token}` }, userId: session.userId };
}

async function watchVideo(userId: string) {
  const now = new Date();
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId: SLUG } },
    create: { userId, lessonId: SLUG, maxPosition: 100, watchedSeconds: 100, lastPosition: 100, completedAt: now, firstCompletedAt: now },
    update: { maxPosition: 100, watchedSeconds: 100, lastPosition: 100, completedAt: now, firstCompletedAt: now },
  });
}

async function progressOf(userId: string) {
  const [video, reviews, views, user] = await Promise.all([
    prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId: SLUG } } }),
    prisma.keywordReview.count({ where: { userId } }),
    prisma.topicKeywordsView.count({ where: { userId } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { topicFlowGatingEnabled: true, progressResetAt: true, paymentStatus: true } }),
  ]);
  return { video, reviews, views, user };
}

beforeAll(async () => {
  process.env.PAYMENT_ENFORCED = "false";
  delete process.env.INITIAL_RESET_ON_DEPLOY;
  delete process.env.TESTER_RESET_ON_DEPLOY;
  LESSON_MAP[SLUG] = { videoId: "e2eFlowVid0", durationSec: 100 };
  await configureAdminEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  reset = app.get(WeeklyResetService);
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.44.0.1");

  // Toza holat (faqat test bazasi): yangilanishlar, arxiv, eski "tester"lar.
  await prisma.weeklyResultArchive.deleteMany({});
  await prisma.weeklyReset.deleteMany({});
  await prisma.user.deleteMany({ where: { OR: [{ firstName: { equals: "tester", mode: "insensitive" } }, { login: "tester" }] } });
  // Joriy hafta "qoplangan" — catch-up test o'rtasida umumiy yangilanish qilmasin.
  await prisma.weeklyReset.create({ data: { weekKey: weekKeyOf(lastResetBoundary(new Date())), status: "covered", triggeredBy: "initial", finishedAt: new Date() } });

  await prisma.topic.deleteMany({ where: { slug: SLUG } });
  const topic = await prisma.topic.create({ data: { slug: SLUG, title: "Oqim mavzusi", kind: "course", day: 6, dayOrder: 91 } });
  topicId = topic.id;
  for (let i = 1; i <= 4; i++) {
    const q = await prisma.question.create({
      data: {
        topicId,
        order: i,
        text: `Савол ${i}`,
        textLatn: `Oqim savoli ${i}: chorrahada kim birinchi o'tadi?`,
        keyword: "",
        options: { create: [{ order: 1, text: "А", isCorrect: true }, { order: 2, text: "Б" }] },
        keywords: { create: { source: "html", questionText: "CHORRAHA", questionTextCyrl: "ЧОРРАҲА", answerText: "A", answerTextCyrl: "А" } },
      },
      include: { options: true },
    });
    questions.push({ id: q.id, correct: q.options.find((o) => o.isCorrect)!.id, wrong: q.options.find((o) => !o.isCorrect)!.id });
  }
}, 60_000);

afterAll(async () => {
  await prisma?.topic.deleteMany({ where: { slug: SLUG } });
  await prisma?.admin.deleteMany({ where: { login: ADMIN } });
  delete LESSON_MAP[SLUG];
  await app?.close();
});

describe("Admin: kun mavzusi savolini o'chirish", () => {
  it("faqat admin: sessiyasiz va o'quvchi tokeni bilan — rad etiladi, savol joyida qoladi", async () => {
    const target = questions[3].id;
    await http().delete(`/admin/content/questions/${target}`).expect(403);
    const student = await newUser();
    await http().delete(`/admin/content/questions/${target}`).set(student.auth).expect(403);
    expect((await prisma.question.findUniqueOrThrow({ where: { id: target } })).deletedAt).toBeNull();
  });

  it("o'chirilgan savol hamma joydan chiqadi; boshlangan urinishlar, eski natijalar va arxiv buzilmaydi", async () => {
    const target = questions[0];
    const runner = await newUser({ unlockAll: true });
    const viewer = await newUser({ unlockAll: true });

    // Eski natija va arxiv yozuvi — o'zgarmasligi kerak.
    const oldAttempt = await prisma.topicTestAttempt.create({ data: { userId: runner.userId, topicId, correct: 4, total: 4, percent: 100 } });
    const archiveRow = await prisma.weeklyResultArchive.create({
      data: { userId: runner.userId, kind: "answer", sourceId: `qdel-${Date.now()}`, weekKey: "qdel-old", data: { questionId: target.id, correct: true }, sourceCreatedAt: new Date() },
    });

    // Boshlangan mavzu testi (savollar olingan), random test va yakuniy imtihon urinishi.
    const started = (await http().get(`/topics/${SLUG}/questions`).set(runner.auth).expect(200)).body as { id: string }[];
    expect(started.map((q) => q.id)).toContain(target.id);
    const random = await prisma.randomTestAttempt.create({
      data: { userId: runner.userId, size: 20, total: 1, deadlineAt: new Date(Date.now() + 3600_000), answers: { create: [{ questionId: target.id, position: 0, optionOrder: [target.correct, target.wrong] }] } },
    });
    const final = await prisma.finalExamAttempt.create({
      data: {
        userId: runner.userId,
        type: "Q20",
        expiresAt: new Date(Date.now() + 3600_000),
        totalQuestions: 1,
        questions: [{ questionId: target.id, topicId, topicSlug: SLUG, day: 6, optionOrder: [target.correct, target.wrong], locked: false }],
      },
    });

    const before = {
      ready: (await http().get("/topics/ready-counts").set(viewer.auth).expect(200)).body[SLUG],
      pool: (await http().get("/random-tests").set(viewer.auth).expect(200)).body,
      admin: (await http().get(`/admin/content/topics/${SLUG}/questions`).set(admin).expect(200)).body,
    };
    expect(before.ready).toBe(4);
    expect((await app.get(FinalExamService).pool()).map((q) => q.id)).toContain(target.id);

    const res = await http().delete(`/admin/content/questions/${target.id}`).set(admin).expect(200);
    expect(res.body).toMatchObject({ id: target.id });
    const row = await prisma.question.findUniqueOrThrow({ where: { id: target.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.deletedById).not.toBeNull();
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "question.deleted", entityId: target.id } });
    expect(audit.adminId).toBe(row.deletedById);
    expect(JSON.stringify(audit.before)).toContain("Oqim savoli 1");

    // Ikkinchi (takroriy / parallel) so'rov — 404, hech narsa o'zgarmaydi.
    await http().delete(`/admin/content/questions/${target.id}`).set(admin).expect(404);
    expect(await prisma.auditLog.count({ where: { action: "question.deleted", entityId: target.id } })).toBe(1);

    // O'quvchi tomoni: test, kalit so'zlar, hisoblagichlar, random va yakuniy imtihon puli.
    const list = (await http().get(`/topics/${SLUG}/questions`).set(viewer.auth).expect(200)).body as { id: string }[];
    expect(list.map((q) => q.id)).not.toContain(target.id);
    expect(list).toHaveLength(3);
    expect((await http().get("/topics/ready-counts").set(viewer.auth).expect(200)).body[SLUG]).toBe(3);
    const kw = (await http().get(`/topics/${SLUG}/keywords`).set(viewer.auth).expect(200)).body;
    expect(kw.total).toBe(3);
    expect(kw.items.map((i: { id: string }) => i.id)).not.toContain(target.id);
    const poolAfter = (await http().get("/random-tests").set(viewer.auth).expect(200)).body;
    expect(JSON.stringify(poolAfter)).not.toEqual(JSON.stringify(before.pool));
    expect((await app.get(FinalExamService).pool()).map((q) => q.id)).not.toContain(target.id);
    const adminList = (await http().get(`/admin/content/topics/${SLUG}/questions`).set(admin).expect(200)).body;
    expect(adminList.total).toBe(before.admin.total - 1);
    expect(adminList.items.map((i: { id: string }) => i.id)).not.toContain(target.id);
    await http().post("/saved").set(viewer.auth).send({ questionId: target.id, sourceMode: "practice" }).expect(404);

    // Boshlangan urinishlar tugaydi: javob tekshiruvi, natija (maxraj — qolgan savollar), random va yakuniy imtihon.
    const check = (await http().post(`/questions/${target.id}/check-answer`).set(runner.auth).send({ optionId: target.correct }).expect(200)).body;
    expect(check.correct).toBe(true);
    const answers = started.map((q) => ({ questionId: q.id, optionId: questions.find((x) => x.id === q.id)!.correct }));
    const saved = (await http().post(`/topics/${SLUG}/attempts`).set(runner.auth).send({ answers }).expect(201)).body;
    expect(saved).toMatchObject({ correct: 3, total: 3, percent: 100 });
    await http().post(`/random-tests/${random.id}/answers`).set(runner.auth).send({ position: 0, optionId: target.correct }).expect(200);
    const finalQs = (await http().get(`/final-exam/attempts/${final.id}/questions`).set(runner.auth).expect(200)).body;
    expect(JSON.stringify(finalQs)).toContain(target.id);
    await http().post(`/final-exam/attempts/${final.id}/answers`).set(runner.auth).send({ position: 0, optionId: target.correct }).expect(200);

    // Eski natija va arxiv o'zgarmagan.
    expect(await prisma.topicTestAttempt.findUniqueOrThrow({ where: { id: oldAttempt.id } })).toEqual(oldAttempt);
    expect(await prisma.weeklyResultArchive.findUniqueOrThrow({ where: { id: archiveRow.id } })).toEqual(archiveRow);
  });

  it("\"Yo'q\" — so'rov yuborilmaydi: boshqa savollar joyida", async () => {
    expect(await prisma.question.count({ where: { topicId, deletedAt: null } })).toBe(3);
  });
});

describe("Kunlik mavzu oqimi: video → kalit so'zlar → test", () => {
  it("oqim yoqilgan: video ko'rilmaguncha test ham, kalit so'zlar ham yopiq", async () => {
    const u = await newUser({ gated: true });
    const q = await http().get(`/topics/${SLUG}/questions`).set(u.auth).expect(403);
    expect(q.body.code).toBe("LESSON_NOT_COMPLETED");
    await http().get(`/topics/${SLUG}/keywords`).set(u.auth).expect(403);
    await http().post(`/topics/${SLUG}/keywords/viewed`).set(u.auth).expect(403);
  });

  it("90% haqiqiy tomosha — oqim yoqilganda ko'rildi; bayroq o'chiq bo'lsa — eski qoida (98% + oxiri)", async () => {
    const gated = await newUser({ gated: true });
    const legacy = await newUser({ gated: false });
    const report = { position: 92, maxPosition: 92, watchedDelta: 92 };
    expect((await http().post(`/lessons/${SLUG}/progress`).set(gated.auth).send(report).expect(200)).body).toMatchObject({ completed: true, everCompleted: true });
    expect((await http().post(`/lessons/${SLUG}/progress`).set(legacy.auth).send(report).expect(200)).body).toMatchObject({ completed: false });
    // Oldinga sakrash (real vaqtdan tez) hisobga olinmaydi.
    const skipper = await newUser({ gated: true });
    const jump = (await http().post(`/lessons/${SLUG}/progress`).set(skipper.auth).send({ position: 95, maxPosition: 95, watchedDelta: 3 }).expect(200)).body;
    expect(jump.completed).toBe(false);
  });

  it("video ko'rilgach — kalit so'zlar ochiq, test esa \"Tanishib chiqdim\"dan keyin", async () => {
    const u = await newUser({ gated: true });
    await watchVideo(u.userId);
    const locked = await http().get(`/topics/${SLUG}/questions`).set(u.auth).expect(403);
    expect(locked.body).toMatchObject({ code: "KEYWORDS_NOT_REVIEWED", flow: true });
    expect(locked.body.message).toBe("Avval videoni ko'ring va kalit so'zlar bilan tanishing");
    const progress = (await http().get(`/topics/${SLUG}/keywords/progress`).set(u.auth).expect(200)).body;
    expect(progress).toMatchObject({ gated: true, viewed: false });
    const viewed = (await http().post(`/topics/${SLUG}/keywords/viewed`).set(u.auth).expect(200)).body;
    expect(viewed).toMatchObject({ gated: true, viewed: true });
    // Idempotent.
    await http().post(`/topics/${SLUG}/keywords/viewed`).set(u.auth).expect(200);
    expect(await prisma.topicKeywordsView.count({ where: { userId: u.userId } })).toBe(1);
    expect((await http().get(`/topics/${SLUG}/questions`).set(u.auth).expect(200)).body).toHaveLength(3);
  });

  it("bayroq o'chiq — eski xatti-harakat: har bir savolga \"Tanishdim\" kerak, \"Tanishib chiqdim\" yetarli emas", async () => {
    const u = await newUser({ gated: false });
    await watchVideo(u.userId);
    await http().post(`/topics/${SLUG}/keywords/viewed`).set(u.auth).expect(200);
    const locked = await http().get(`/topics/${SLUG}/questions`).set(u.auth).expect(403);
    expect(locked.body.code).toBe("KEYWORDS_NOT_REVIEWED");
    expect(locked.body.flow).toBeUndefined();
    await reviewAllKeywords(app, u.auth, SLUG);
    await http().get(`/topics/${SLUG}/questions`).set(u.auth).expect(200);
  });

  it("admin \"hammasini ochgan\" o'quvchi — oqim talab qilinmaydi", async () => {
    const u = await newUser({ gated: true, unlockAll: true });
    await http().get(`/topics/${SLUG}/questions`).set(u.auth).expect(200);
  });

  it("yangi ro'yxatdan o'tgan foydalanuvchida oqim yoqiladi", async () => {
    const { token } = await app.get(AuthService).createAnonymousSession();
    const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
    await prisma.user.update({ where: { id: session.userId }, data: { topicFlowGatingEnabled: false } });
    const me = (
      await http()
        .post("/me/register")
        .set({ Authorization: `Bearer ${token}` })
        .send({ firstName: "Yangi", lastName: "Oquvchi", age: 20, phone: `+99890${String(Date.now()).slice(-7)}`, examStatus: "first-time", consent: true })
        .expect(200)
    ).body;
    expect(me.topicFlowGating).toBe(true);
  });
});

describe("Haftalik yangilanish: video va kalit so'zlar progressi", () => {
  let user: Awaited<ReturnType<typeof newUser>>;
  let umar: Awaited<ReturnType<typeof newUser>>;
  const WEEK = "flow-e2e-week";

  it("arxivlab nollaydi, bayroqni yoqadi; exempt (Umar) va yakuniy imtihon/sertifikat/to'lovga tegmaydi", async () => {
    user = await newUser({ gated: false });
    umar = await newUser({ firstName: "Umar", gated: false });
    await prisma.user.update({ where: { id: umar.userId }, data: { weeklyResetExempt: true } });
    for (const u of [user, umar]) {
      await watchVideo(u.userId);
      await reviewAllKeywords(app, u.auth, SLUG);
      await http().post(`/topics/${SLUG}/keywords/viewed`).set(u.auth).expect(200);
    }
    const final = await prisma.finalExamAttempt.create({
      data: { userId: user.userId, type: "Q50", status: "FINISHED", expiresAt: new Date(), finishedAt: new Date(), totalQuestions: 50, correctCount: 50, scorePercent: 100, questions: [] },
    });
    const cert = await prisma.certificate.create({
      data: { userId: user.userId, examType: "Q50", fullName: "Flow E2e", averagePercent: 100, attemptsCount: 10, certificateNumber: `PI-FL-${Date.now() % 1e9}`, letterText: "x", letterTone: "perfect" },
    });
    await prisma.user.update({ where: { id: user.userId }, data: { paymentStatus: "PAID", accessGrantedAt: new Date() } });
    const umarBefore = await progressOf(umar.userId);
    const statusBefore = (await http().get("/meta/reset-status").set(user.auth).expect(200)).body;

    // dryRun — hech narsa o'zgarmaydi.
    const dry = await reset.run({ weekKey: "flow-dry", triggeredBy: "manual", includeExempt: false, dryRun: true });
    expect(dry.counts.videoProgress).toBeGreaterThanOrEqual(1);
    expect(dry.counts.keywordViews).toBeGreaterThanOrEqual(1);
    expect(dry.counts.flowEnabled).toBeGreaterThanOrEqual(1);
    expect((await progressOf(user.userId)).views).toBe(1);

    const res = await reset.run({ weekKey: WEEK, triggeredBy: "manual", includeExempt: false });
    expect(res.skipped).toBe(false);

    const after = await progressOf(user.userId);
    expect(after.video).toMatchObject({ maxPosition: 0, watchedSeconds: 0, lastPosition: 0, completedAt: null });
    expect(after.video?.firstCompletedAt).not.toBeNull();
    expect(after).toMatchObject({ reviews: 0, views: 0, user: { topicFlowGatingEnabled: true, paymentStatus: "PAID" } });
    expect(await prisma.finalExamAttempt.findUnique({ where: { id: final.id } })).not.toBeNull();
    expect(await prisma.certificate.findUnique({ where: { id: cert.id } })).not.toBeNull();

    // Arxiv: video va kalit so'zlar alohida turlar.
    const archived = await prisma.weeklyResultArchive.findMany({ where: { userId: user.userId, weekKey: WEEK, kind: { in: ["video_progress", "keywords_progress"] } } });
    const video = archived.find((a) => a.kind === "video_progress");
    const keywords = archived.find((a) => a.kind === "keywords_progress");
    expect(video?.data).toMatchObject({ lessonId: SLUG, maxPosition: 100 });
    expect((video?.data as { completedAt: string | null }).completedAt).not.toBeNull();
    expect(keywords?.data).toMatchObject({ topicSlug: SLUG, reviewedQuestions: 3 });
    expect((keywords?.data as { viewedAt: string | null }).viewedAt).not.toBeNull();

    // Umar: hech narsa o'zgarmagan, bayroq ham false.
    expect(await progressOf(umar.userId)).toEqual(umarBefore);
    expect(await prisma.weeklyResultArchive.count({ where: { userId: umar.userId, weekKey: WEEK } })).toBe(0);

    // Jonli yangilanish: lastResetAt o'zgardi.
    const statusAfter = (await http().get("/meta/reset-status").set(user.auth).expect(200)).body;
    expect(statusAfter.lastResetAt).not.toBe(statusBefore.lastResetAt);
  });

  it("yangilanishdan keyin: test yopiq (video qaytadan), lekin boshlangan test natijasi saqlanadi", async () => {
    expect((await http().get(`/topics/${SLUG}/questions`).set(user.auth).expect(403)).body.code).toBe("LESSON_NOT_COMPLETED");
    const status = (await http().get(`/lessons/${SLUG}`).set(user.auth).expect(200)).body;
    expect(status).toMatchObject({ completed: false, everCompleted: true, watchedPercent: 0 });
    await http().post(`/questions/${questions[1].id}/check-answer`).set(user.auth).send({ optionId: questions[1].correct }).expect(200);
    await http().post(`/topics/${SLUG}/attempts`).set(user.auth).send({ answers: [{ questionId: questions[1].id, optionId: questions[1].correct }] }).expect(201);
  });

  it("admin arxivida hafta bo'yicha video va kalit so'zlar ko'rinadi", async () => {
    const weeks = (await http().get(`/admin/users/${user.userId}/results-archive`).set(admin).expect(200)).body;
    const week = weeks.weeks.find((w: { weekKey: string }) => w.weekKey === WEEK);
    expect(week).toMatchObject({ videosWatched: 1, videoLessons: 1, keywordsViewed: 1, keywordTopics: 1 });
    expect(weeks.topicFlowGatingEnabled).toBe(true);
    const detail = (await http().get(`/admin/users/${user.userId}/results-archive/${WEEK}`).set(admin).expect(200)).body;
    expect(detail.videoProgress).toEqual([expect.objectContaining({ topicSlug: SLUG, completed: true, watchedPercent: 100 })]);
    expect(detail.keywordsProgress).toEqual([expect.objectContaining({ topicSlug: SLUG, reviewedQuestions: 3 })]);
  });

  it("arxivlash xatosida nollash bajarilmaydi (video ham, bayroq ham)", async () => {
    const u = await newUser({ gated: false });
    await watchVideo(u.userId);
    await http().post(`/topics/${SLUG}/keywords/viewed`).set(u.auth).expect(200);
    const spy = vi.spyOn(reset, "archiveKeywordsProgress").mockRejectedValueOnce(new Error("arxiv xatosi"));
    await expect(reset.run({ weekKey: "flow-tx-fail", triggeredBy: "manual", includeExempt: false })).rejects.toThrow("arxiv xatosi");
    spy.mockRestore();
    const p = await progressOf(u.userId);
    expect(p.video?.completedAt).not.toBeNull();
    expect(p.views).toBe(1);
    expect(p.user.topicFlowGatingEnabled).toBe(false);
    expect(await prisma.weeklyResultArchive.count({ where: { weekKey: "flow-tx-fail" } })).toBe(0);
  });
});

describe("tester-reset va admin \"Progressni to'liq nolga tushirish\"", () => {
  it("bir nechta \"tester\" — hech kimga qo'llanmaydi, nomzodlar qaytadi", async () => {
    const a = await newUser({ firstName: "Tester", gated: false });
    const b = await newUser({ firstName: "tester", gated: false });
    await watchVideo(a.userId);
    const out = await reset.runTesterResetIfNeeded();
    expect(out.result).toBeNull();
    expect(out.candidates.filter((c) => c.exact).map((c) => c.id).sort()).toEqual([a.userId, b.userId].sort());
    expect(await prisma.weeklyReset.findUnique({ where: { weekKey: TESTER_WEEK_KEY } })).toBeNull();
    expect((await progressOf(a.userId)).video?.completedAt).not.toBeNull();
    await prisma.user.delete({ where: { id: b.userId } });
    await prisma.user.delete({ where: { id: a.userId } });
  });

  it("aynan bitta \"tester\": faqat u nollanadi, bayroq yoqiladi; idempotent (deploy flag bilan ham)", async () => {
    const tester = await newUser({ firstName: "Tester", gated: false });
    const other = await newUser({ gated: false });
    for (const u of [tester, other]) {
      await watchVideo(u.userId);
      await http().post(`/topics/${SLUG}/keywords/viewed`).set(u.auth).expect(200);
      await prisma.topicTestAttempt.create({ data: { userId: u.userId, topicId, correct: 3, total: 3, percent: 100 } });
    }
    const otherBefore = await progressOf(other.userId);
    const globalResets = await prisma.weeklyReset.count({ where: { userId: null } });
    const otherStatus = (await http().get("/meta/reset-status").set(other.auth).expect(200)).body;

    process.env.TESTER_RESET_ON_DEPLOY = "true";
    await reset.onApplicationBootstrap();
    const row = await prisma.weeklyReset.findUniqueOrThrow({ where: { weekKey: TESTER_WEEK_KEY } });
    expect(row).toMatchObject({ status: "done", triggeredBy: "tester", userId: tester.userId });

    const p = await progressOf(tester.userId);
    expect(p).toMatchObject({ reviews: 0, views: 0, user: { topicFlowGatingEnabled: true } });
    expect(p.video?.completedAt).toBeNull();
    expect(p.user.progressResetAt).not.toBeNull();
    expect(await prisma.topicTestAttempt.count({ where: { userId: tester.userId, archivedAt: null } })).toBe(0);
    expect(await prisma.weeklyResultArchive.count({ where: { userId: tester.userId, weekKey: TESTER_WEEK_KEY } })).toBeGreaterThanOrEqual(3);

    // Boshqa foydalanuvchiga va umumiy holatga ta'sir yo'q.
    expect(await progressOf(other.userId)).toEqual(otherBefore);
    expect(await prisma.topicTestAttempt.count({ where: { userId: other.userId, archivedAt: null } })).toBe(1);
    expect(await prisma.weeklyReset.count({ where: { userId: null } })).toBe(globalResets);
    expect((await http().get("/meta/reset-status").set(other.auth).expect(200)).body.lastResetAt).toBe(otherStatus.lastResetAt);
    const testerStatus = (await http().get("/meta/reset-status").set(tester.auth).expect(200)).body;
    expect(testerStatus.lastResetAt).toBe(p.user.progressResetAt?.toISOString());

    // Qayta (deploy flag hali true) — hech narsa o'zgarmaydi.
    await watchVideo(tester.userId);
    const archiveTotal = await prisma.weeklyResultArchive.count();
    await reset.onApplicationBootstrap();
    expect(await prisma.weeklyResultArchive.count()).toBe(archiveTotal);
    expect((await progressOf(tester.userId)).video?.completedAt).not.toBeNull();
    delete process.env.TESTER_RESET_ON_DEPLOY;

    // Tester endi oqim bilan: video bor, "Tanishib chiqdim"siz test yopiq.
    expect((await http().get(`/topics/${SLUG}/questions`).set(tester.auth).expect(403)).body.code).toBe("KEYWORDS_NOT_REVIEWED");
  });

  it("admin nollashi: NOLLASH so'zisiz 400, dryRun o'zgartirmaydi, keyin arxivlab nollaydi va audit", async () => {
    const u = await newUser({ gated: false });
    await watchVideo(u.userId);
    await http().post(`/admin/users/${u.userId}/progress-reset`).send({ confirm: "NOLLASH" }).expect(403);
    await http().post(`/admin/users/${u.userId}/progress-reset`).set(admin).send({}).expect(400);
    await http().post(`/admin/users/${u.userId}/progress-reset`).set(admin).send({ confirm: "nollash" }).expect(400);
    const dry = (await http().post(`/admin/users/${u.userId}/progress-reset`).set(admin).send({ confirm: "NOLLASH", dryRun: true }).expect(200)).body;
    expect(dry).toMatchObject({ dryRun: true, affectedUsers: 1, counts: { videoProgress: 1, flowEnabled: 1 } });
    expect((await progressOf(u.userId)).video?.completedAt).not.toBeNull();
    const run = (await http().post(`/admin/users/${u.userId}/progress-reset`).set(admin).send({ confirm: "NOLLASH" }).expect(200)).body;
    expect(run.weekKey).toMatch(/^user-/);
    expect(await prisma.auditLog.count({ where: { action: "user.progress_reset", entityId: u.userId } })).toBe(1);
    const p = await progressOf(u.userId);
    expect(p.video?.completedAt).toBeNull();
    expect(p.user.topicFlowGatingEnabled).toBe(true);
    const weeks = (await http().get(`/admin/users/${u.userId}/results-archive`).set(admin).expect(200)).body;
    expect(weeks.weeks.find((w: { weekKey: string }) => w.weekKey === run.weekKey)).toMatchObject({ videosWatched: 1 });
    await http().post(`/admin/users/00000000-0000-4000-8000-000000000000/progress-reset`).set(admin).send({ confirm: "NOLLASH" }).expect(404);
  });
});
