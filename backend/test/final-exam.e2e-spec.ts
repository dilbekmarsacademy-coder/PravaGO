import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { FinalExamType } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService, hashToken } from "../src/auth/auth.service";
import { FinalExamService, type AttemptQuestion } from "../src/final-exam/final-exam.service";
import { LESSONS } from "../src/lessons/lessons.config";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// Yakuniy ichki imtihon: qulf (backend), savollar manbai, server taymeri,
// javob xavfsizligi, 10 urinish, 98% va sertifikat, admin.
const DAYS = [1, 2, 3, 4, 5, 6];
const TOPICS_PER_DAY = 3;
const PER_TOPIC = 10;
const SLUGS = DAYS.flatMap((d) => Array.from({ length: TOPICS_PER_DAY }, (_, t) => `day${d}-topic${t + 1}`));
/** Imtihonga kirmasligi kerak bo'lgan manbalar: 7-kun va "Yangi testlar" to'plami. */
const OUTSIDE = ["day7-topic1", "new-final-exam-e2e"];
const ADMIN = "e2e-final";
const PASSWORD = "Final-Exam-2026";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
const http = () => request(app.getHttpServer());
const topicIds: string[] = [];
const lockedQuestionIds = new Set<string>();

type QuestionRow = { position: number; topicSlug: string; selectedOptionId: string | null; question: { id: string; options: { id: string }[] }; review: null | { correctOptionId: string } };

async function newUser(name?: { firstName: string; lastName: string }) {
  const { token } = await app.get(AuthService).createAnonymousSession();
  const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  if (name) await prisma.user.update({ where: { id: session.userId }, data: name });
  return { auth: { Authorization: `Bearer ${token}` }, userId: session.userId };
}

/** 1–6-kun barcha mavzularini tugatgan: testlar 100%, testsiz (faqat video) mavzularda video ko'rilgan. */
async function completeCourse(userId: string) {
  await prisma.topicTestAttempt.createMany({ data: topicIds.map((topicId) => ({ userId, topicId, correct: 10, total: 10, percent: 100 })) });
  const lessons = Object.keys(LESSONS).filter((id) => /^day[1-6]-/.test(id));
  await prisma.lessonProgress.createMany({ data: lessons.map((lessonId) => ({ userId, lessonId, maxPosition: 1, watchedSeconds: 1, completedAt: new Date() })) });
}

const correctOf = async (questionId: string) => (await prisma.option.findFirstOrThrow({ where: { questionId, isCorrect: true } })).id;
const wrongOf = async (questionId: string) => (await prisma.option.findFirstOrThrow({ where: { questionId, isCorrect: false } })).id;

/** Yakunlangan urinishlarni bevosita bazaga yozish (10 ta urinishni tezlashtirish). */
async function seedFinished(userId: string, type: FinalExamType, percents: number[]) {
  const base = Date.now() - 86_400_000;
  for (const [i, p] of percents.entries()) {
    const total = type === "Q20" ? 20 : 50;
    await prisma.finalExamAttempt.create({
      data: {
        userId,
        type,
        status: "FINISHED",
        startedAt: new Date(base + i * 60_000),
        expiresAt: new Date(base + i * 60_000 + 25 * 60_000),
        finishedAt: new Date(base + i * 60_000 + 60_000),
        totalQuestions: total,
        correctCount: Math.round((p / 100) * total),
        scorePercent: p,
        questions: [],
      },
    });
  }
}

beforeAll(async () => {
  process.env.PAYMENT_ENFORCED = "false";
  await configureAdminEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  // Test bazasidagi boshqa kurs mavzulari qulf va manbaga ta'sir qilmasin.
  await prisma.topic.deleteMany({ where: { OR: [{ slug: { in: [...SLUGS, ...OUTSIDE] } }, { kind: "course", slug: { startsWith: "day" } }] } });
  for (const slug of SLUGS) {
    const topic = await prisma.topic.create({ data: { slug, title: `Mavzu ${slug}` } });
    topicIds.push(topic.id);
    for (let i = 1; i <= PER_TOPIC; i++) {
      // Har mavzuda 1-savol — "Hammasi to'g'ri" variantli (tartibi o'zgarmasligi kerak).
      const locked = i === 1;
      const q = await prisma.question.create({
        data: {
          topicId: topic.id,
          order: i,
          text: `Савол ${slug} ${i}`,
          textLatn: `Savol ${slug} ${i}`,
          keyword: "",
          options: {
            create: locked
              ? [{ order: 1, text: "Қизил", textLatn: "Qizil" }, { order: 2, text: "Сариқ", textLatn: "Sariq" }, { order: 3, text: "Ҳаммаси тўғри", textLatn: "Hammasi to'g'ri", isCorrect: true }]
              : [{ order: 1, text: "Тўхташ", isCorrect: true }, { order: 2, text: "Давом этиш" }, { order: 3, text: "Секинлаш" }, { order: 4, text: "Бурилиш" }],
          },
        },
      });
      if (locked) lockedQuestionIds.add(q.id);
    }
  }
  for (const slug of OUTSIDE) {
    const topic = await prisma.topic.create({ data: { slug, title: slug, ...(slug.startsWith("new-") ? { kind: "collection" } : {}) } });
    for (let i = 1; i <= 30; i++) {
      await prisma.question.create({ data: { topicId: topic.id, order: i, text: `Ташқи ${i}`, keyword: "", options: { create: [{ order: 1, text: "А", isCorrect: true }, { order: 2, text: "Б" }] } } });
    }
  }
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.77.0.1");
});

afterAll(async () => {
  await prisma.topic.deleteMany({ where: { slug: { in: [...SLUGS, ...OUTSIDE] } } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  await app.close();
});

describe("Yakuniy imtihon — qulf va boshlash", () => {
  it("1–6-kun tugatilmagan ham to'g'ridan-to'g'ri boshlay oladi (kurs sharti o'chirilgan); sessiyasiz — 401", async () => {
    const user = await newUser();
    await http().get("/final-exam").expect(401);
    const overview = (await http().get("/final-exam").set(user.auth).expect(200)).body;
    expect(overview).toMatchObject({ unlocked: true, poolSize: SLUGS.length * PER_TOPIC });
    // Kurs progressi ma'lumot sifatida qaytadi (admin uchun), imtihonni to'smaydi.
    expect(overview.remainingTopics).toBeGreaterThanOrEqual(SLUGS.length);
    const state = (await http().post("/final-exam").set(user.auth).send({ type: "Q20" }).expect(201)).body;
    expect(state).toMatchObject({ type: "Q20", status: "IN_PROGRESS", total: 20, attemptNo: 1 });
  });

  it("kursga kirish huquqi baribir kerak (to'lov sharti yoqilgan, to'lanmagan — 403)", async () => {
    const user = await newUser();
    process.env.PAYMENT_ENFORCED = "true";
    try {
      await http().post("/final-exam").set(user.auth).send({ type: "Q20" }).expect(403);
    } finally {
      process.env.PAYMENT_ENFORCED = "false";
    }
  });

  it("20 talik: savollar faqat 1–6-kun testlaridan, kunlar teng, ketma-ket bir mavzu yo'q, to'g'ri javob chiqmaydi", async () => {
    const user = await newUser();
    await completeCourse(user.userId);
    const state = (await http().post("/final-exam").set(user.auth).send({ type: "Q20" }).expect(201)).body;
    expect(state).toMatchObject({ type: "Q20", status: "IN_PROGRESS", total: 20, attemptNo: 1, attemptsUsed: 1, maxAttempts: 10, average: null });
    expect(state.remainingMs).toBeGreaterThan(24 * 60_000);
    expect(state.remainingMs).toBeLessThanOrEqual(25 * 60_000);
    // Bir turda bitta faol urinish.
    expect((await http().post("/final-exam").set(user.auth).send({ type: "Q20" }).expect(409)).body).toMatchObject({ code: "FINAL_EXAM_ACTIVE", attemptId: state.id });

    const res = await http().get(`/final-exam/attempts/${state.id}/questions`).set(user.auth).expect(200);
    const rows = res.body as QuestionRow[];
    expect(rows).toHaveLength(20);
    expect(JSON.stringify(res.body)).not.toMatch(/isCorrect|correctOptionId|keyword/);
    expect(rows.every((r) => r.review === null)).toBe(true);
    expect(rows.every((r) => SLUGS.includes(r.topicSlug))).toBe(true);
    expect(new Set(rows.map((r) => r.question.id)).size).toBe(20);
    const perDay = DAYS.map((d) => rows.filter((r) => r.topicSlug.startsWith(`day${d}-`)).length);
    expect(Math.max(...perDay) - Math.min(...perDay)).toBeLessThanOrEqual(1);
    for (let i = 1; i < rows.length; i++) expect(rows[i].topicSlug).not.toBe(rows[i - 1].topicSlug);
  });

  it("50 talik — alohida hisoblagich, 45 daqiqa", async () => {
    const user = await newUser();
    await completeCourse(user.userId);
    await http().post("/final-exam").set(user.auth).send({ type: "Q20" }).expect(201);
    const state = (await http().post("/final-exam").set(user.auth).send({ type: "Q50" }).expect(201)).body;
    expect(state).toMatchObject({ type: "Q50", total: 50, attemptsUsed: 1 });
    expect(state.remainingMs).toBeGreaterThan(44 * 60_000);
    const overview = (await http().get("/final-exam").set(user.auth).expect(200)).body;
    expect(overview.types.map((t: { type: string; attemptsUsed: number; attemptsLeft: number }) => [t.type, t.attemptsUsed, t.attemptsLeft])).toEqual([
      ["Q20", 1, 9],
      ["Q50", 1, 9],
    ]);
  });
});

describe("Yakuniy imtihon — javoblar va taymer", () => {
  it("javob variant ID bo'yicha tekshiriladi (joyi emas); natija tugaguncha chiqmaydi; bir marta", async () => {
    const user = await newUser();
    await completeCourse(user.userId);
    const { id } = (await http().post("/final-exam").set(user.auth).send({ type: "Q20" }).expect(201)).body;
    const rows = (await http().get(`/final-exam/attempts/${id}/questions`).set(user.auth).expect(200)).body as QuestionRow[];
    // Birinchi 10 tasi — to'g'ri (qaysi joyda turgani muhim emas), 11-si — xato, qolgani javobsiz.
    for (const r of rows.slice(0, 10)) {
      const body = (await http().post(`/final-exam/attempts/${id}/answers`).set(user.auth).send({ position: r.position, optionId: await correctOf(r.question.id) }).expect(200)).body;
      expect(JSON.stringify(body)).not.toMatch(/correctOptionId|"correct":true/);
    }
    await http().post(`/final-exam/attempts/${id}/answers`).set(user.auth).send({ position: 10, optionId: await wrongOf(rows[10].question.id) }).expect(200);
    expect((await http().post(`/final-exam/attempts/${id}/answers`).set(user.auth).send({ position: 0, optionId: await wrongOf(rows[0].question.id) }).expect(409)).body.code).toBe(
      "FINAL_EXAM_ALREADY_ANSWERED",
    );
    // Boshqa savolning varianti — 400.
    await http().post(`/final-exam/attempts/${id}/answers`).set(user.auth).send({ position: 12, optionId: await correctOf(rows[0].question.id) }).expect(400);
    // Boshqa foydalanuvchi — 404.
    const other = await newUser();
    await http().get(`/final-exam/attempts/${id}`).set(other.auth).expect(404);

    const done = (await http().post(`/final-exam/attempts/${id}/finish`).set(user.auth).expect(200)).body;
    expect(done).toMatchObject({ status: "FINISHED", correct: 10, percent: 50, answered: 11, average: 50, outcome: "in_progress" });
    const review = (await http().get(`/final-exam/attempts/${id}/questions`).set(user.auth).expect(200)).body as QuestionRow[];
    expect(review[0].review?.correctOptionId).toBe(await correctOf(rows[0].question.id));
    // Tugagan imtihonga javob yo'q.
    expect((await http().post(`/final-exam/attempts/${id}/answers`).set(user.auth).send({ position: 15, optionId: await correctOf(rows[15].question.id) }).expect(409)).body.code).toBe(
      "FINAL_EXAM_FINISHED",
    );
  });

  it("taymer tugagach javob qabul qilinmaydi; urinish avtomatik yakunlanadi (javobsizlar xato)", async () => {
    const user = await newUser();
    await completeCourse(user.userId);
    const { id } = (await http().post("/final-exam").set(user.auth).send({ type: "Q20" }).expect(201)).body;
    const rows = (await http().get(`/final-exam/attempts/${id}/questions`).set(user.auth).expect(200)).body as QuestionRow[];
    await http().post(`/final-exam/attempts/${id}/answers`).set(user.auth).send({ position: 0, optionId: await correctOf(rows[0].question.id) }).expect(200);
    await prisma.finalExamAttempt.update({ where: { id }, data: { startedAt: new Date(Date.now() - 26 * 60_000), expiresAt: new Date(Date.now() - 60_000) } });
    expect((await http().post(`/final-exam/attempts/${id}/answers`).set(user.auth).send({ position: 1, optionId: await correctOf(rows[1].question.id) }).expect(409)).body.code).toBe(
      "FINAL_EXAM_TIME_UP",
    );
    const state = (await http().get(`/final-exam/attempts/${id}`).set(user.auth).expect(200)).body;
    expect(state).toMatchObject({ status: "EXPIRED", correct: 1, percent: 5, remainingMs: 0 });
    // Tugagan urinish qayta ochilmaydi — yangisi boshlanadi va u 2-urinish.
    const next = (await http().post("/final-exam").set(user.auth).send({ type: "Q20" }).expect(201)).body;
    expect(next).toMatchObject({ attemptNo: 2, attemptsUsed: 2, average: 5 });
  });

  it("variantlar: 'Hammasi to'g'ri' savollarida tartib o'zgarmaydi (skip ham), oddiylarida urinishlar orasida o'zgaradi", async () => {
    const user = await newUser();
    await completeCourse(user.userId);
    const seenOrders = new Map<string, Set<string>>();
    for (let n = 0; n < 6; n++) {
      const { id } = (await http().post("/final-exam").set(user.auth).send({ type: "Q50" }).expect(201)).body;
      const attempt = await prisma.finalExamAttempt.findUniqueOrThrow({ where: { id } });
      for (const q of attempt.questions as unknown as AttemptQuestion[]) {
        const source = (await prisma.option.findMany({ where: { questionId: q.questionId }, orderBy: { order: "asc" } })).map((o) => o.id);
        if (lockedQuestionIds.has(q.questionId)) {
          expect(q.locked).toBe(true);
          expect(q.optionOrder).toEqual(source);
        } else {
          expect(q.locked).toBe(false);
          seenOrders.set(q.questionId, (seenOrders.get(q.questionId) ?? new Set()).add(q.optionOrder.join()));
        }
      }
      // Javobsiz tashlab ketilgan savol: oddiy — har variant boshqa joyga; qulflangan — o'zgarmaydi.
      const items = attempt.questions as unknown as AttemptQuestion[];
      const plainPos = items.findIndex((q) => !q.locked);
      const skipped = (await http().post(`/final-exam/attempts/${id}/skip`).set(user.auth).send({ position: plainPos }).expect(200)).body;
      expect(skipped.optionOrder.every((oid: string, i: number) => oid !== items[plainPos].optionOrder[i])).toBe(true);
      const rows = (await http().get(`/final-exam/attempts/${id}/questions`).set(user.auth).expect(200)).body as QuestionRow[];
      expect(rows[plainPos].question.options.map((o) => o.id)).toEqual(skipped.optionOrder);
      const lockedPos = items.findIndex((q) => q.locked);
      if (lockedPos >= 0) {
        expect((await http().post(`/final-exam/attempts/${id}/skip`).set(user.auth).send({ position: lockedPos }).expect(200)).body.optionOrder).toEqual(items[lockedPos].optionOrder);
      }
      await http().post(`/final-exam/attempts/${id}/finish`).set(user.auth).expect(200);
    }
    // Bir necha marta chiqqan oddiy savollar — tartib kamida bittasida o'zgargan.
    const repeated = [...seenOrders.values()].filter((s) => s.size > 0);
    expect([...seenOrders.values()].some((s) => s.size > 1)).toBe(true);
    expect(repeated.length).toBeGreaterThan(0);
  });
});

describe("Yakuniy imtihon — 10 urinish, 98% va sertifikat", () => {
  it("9 ta urinish 100% — sertifikat yo'q; 10-si API orqali 100% — sertifikat, xat; 11-urinish yo'q", async () => {
    const user = await newUser({ firstName: "Aziza", lastName: "Karimova" });
    await completeCourse(user.userId);
    await seedFinished(user.userId, "Q20", Array(9).fill(100));
    let overview = (await http().get("/final-exam").set(user.auth).expect(200)).body;
    expect(overview.types[0]).toMatchObject({ attemptsUsed: 9, outcome: "in_progress", certificate: null, average: 100 });
    expect(await prisma.certificate.count({ where: { userId: user.userId } })).toBe(0);

    const { id } = (await http().post("/final-exam").set(user.auth).send({ type: "Q20" }).expect(201)).body;
    const rows = (await http().get(`/final-exam/attempts/${id}/questions`).set(user.auth).expect(200)).body as QuestionRow[];
    let last: Record<string, unknown> = {};
    for (const r of rows) last = (await http().post(`/final-exam/attempts/${id}/answers`).set(user.auth).send({ position: r.position, optionId: await correctOf(r.question.id) }).expect(200)).body;
    // Hamma savolga javob — o'zi yakunlandi.
    expect(last).toMatchObject({ status: "FINISHED", percent: 100, attemptNo: 10, average: 100, outcome: "passed" });
    expect(last.certificateNumber).toMatch(/^PI-\d{4}-\d{6}$/);

    const certs = (await http().get("/certificates").set(user.auth).expect(200)).body;
    expect(certs).toHaveLength(1);
    expect(certs[0]).toMatchObject({ examType: "Q20", questions: 20, averagePercent: 100, attemptsCount: 10, fullName: "Aziza Karimova", letterTone: "perfect", celebrated: false });
    expect(certs[0].letterText).toContain("100%");

    expect((await http().post("/final-exam").set(user.auth).send({ type: "Q20" }).expect(409)).body.code).toBe("FINAL_EXAM_NO_ATTEMPTS");
    overview = (await http().get("/final-exam").set(user.auth).expect(200)).body;
    expect(overview.types[0]).toMatchObject({ attemptsUsed: 10, attemptsLeft: 0, outcome: "passed" });

    // Ommaviy tekshirish va "ko'rildi".
    const number = certs[0].certificateNumber as string;
    expect((await http().get(`/public/certificates/${number}`).expect(200)).body).toMatchObject({ fullName: "Aziza Karimova", averagePercent: 100, questions: 20 });
    await http().get("/public/certificates/PI-1999-999999").expect(404);
    await http().get("/public/certificates/abc").expect(400);
    await http().post(`/certificates/${number}/celebrated`).set(user.auth).expect(200);
    expect((await http().get(`/certificates/${number}`).set(user.auth).expect(200)).body.celebrated).toBe(true);
    // Boshqa foydalanuvchi o'zgalarnikini ololmaydi.
    const other = await newUser();
    await http().get(`/certificates/${number}`).set(other.auth).expect(404);
  });

  it("chegara: o'rtacha 97,9 — o'tmaydi (xabar bilan), 98,0 — o'tadi", async () => {
    const below = await newUser({ firstName: "Past", lastName: "Natija" });
    await seedFinished(below.userId, "Q50", [...Array(9).fill(98), 97]);
    const failed = (await http().get("/final-exam").set(below.auth).expect(200)).body.types[1];
    expect(failed).toMatchObject({ average: 97.9, outcome: "failed", certificate: null });
    expect(failed.failureNote).toMatch(/administratorga murojaat/);

    const exact = await newUser({ firstName: "Chegara", lastName: "Natija" });
    await seedFinished(exact.userId, "Q50", Array(10).fill(98));
    const passed = (await http().get("/final-exam").set(exact.auth).expect(200)).body.types[1];
    expect(passed).toMatchObject({ average: 98, outcome: "passed" });
    expect(passed.certificate.averagePercent).toBe(98);
  });

  it("bir turga ikkinchi sertifikat berilmaydi; klient 'o'tdim' deb yubora olmaydi", async () => {
    const user = await newUser({ firstName: "Bir", lastName: "Marta" });
    await seedFinished(user.userId, "Q20", Array(10).fill(100));
    const service = app.get(FinalExamService);
    const [a, b] = await Promise.all([service.issueCertificateIfPassed(user.userId, "Q20"), service.issueCertificateIfPassed(user.userId, "Q20")]);
    expect(a?.certificateNumber).toBe(b?.certificateNumber);
    expect(await prisma.certificate.count({ where: { userId: user.userId, examType: "Q20" } })).toBe(1);
    // Sertifikat yaratish uchun klient endpointi yo'q; whitelist qo'shimcha maydonni rad etadi.
    await http().post("/certificates").set(user.auth).send({ type: "Q20", passed: true }).expect(404);
    await http().post("/final-exam").set(user.auth).send({ type: "Q20", passed: true }).expect(400);
  });

  it("ism bo'lmasa — sertifikatga bir marta kiritiladi", async () => {
    const user = await newUser();
    await seedFinished(user.userId, "Q20", Array(10).fill(100));
    const cert = (await http().get("/final-exam").set(user.auth).expect(200)).body.types[0].certificate;
    expect((await http().get(`/certificates/${cert.certificateNumber}`).set(user.auth).expect(200)).body.fullName).toBe("");
    await http().post(`/certificates/${cert.certificateNumber}/name`).set(user.auth).send({ fullName: "  Ism   Familiya " }).expect(200);
    expect((await http().get(`/certificates/${cert.certificateNumber}`).set(user.auth).expect(200)).body.fullName).toBe("Ism Familiya");
    expect((await http().post(`/certificates/${cert.certificateNumber}/name`).set(user.auth).send({ fullName: "Boshqa Ism" }).expect(409)).body.code).toBe("CERTIFICATE_NAME_SET");
  });
});

describe("Yakuniy imtihon — admin", () => {
  it("ro'yxat, foydalanuvchi urinishlari va nolga qaytarish (audit)", async () => {
    const user = await newUser({ firstName: "Admin", lastName: "Korsin" });
    await completeCourse(user.userId);
    await seedFinished(user.userId, "Q20", [...Array(9).fill(95), 90]);
    await http().get(`/admin/final-exam/users/${user.userId}`).expect(403);
    const list = (await http().get("/admin/final-exam?q=Korsin").set(admin).expect(200)).body;
    expect(list.items[0]).toMatchObject({ user: { id: user.userId }, types: [{ type: "Q20", attemptsUsed: 10, average: 94.5, certificateNumber: null }, { type: "Q50", attemptsUsed: 0 }] });
    const detail = (await http().get(`/admin/final-exam/users/${user.userId}`).set(admin).expect(200)).body;
    expect(detail.types[0].attempts).toHaveLength(10);
    expect(detail.types[0].attempts[9].percent).toBe(90);
    expect(detail.types[0].attempts[0].durationSec).toBe(60);

    expect((await http().post("/final-exam").set(user.auth).send({ type: "Q20" }).expect(409)).body.code).toBe("FINAL_EXAM_NO_ATTEMPTS");
    expect((await http().post(`/admin/final-exam/users/${user.userId}/reset`).set(admin).send({ type: "Q20" }).expect(200)).body).toMatchObject({ archived: 10 });
    expect(await prisma.auditLog.count({ where: { action: "final_exam.reset", entityId: user.userId } })).toBe(1);
    const overview = (await http().get("/final-exam").set(user.auth).expect(200)).body;
    expect(overview.types[0]).toMatchObject({ attemptsUsed: 0, attemptsLeft: 10, average: null, outcome: "in_progress" });
    await http().post("/final-exam").set(user.auth).send({ type: "Q20" }).expect(201);
    expect((await http().get(`/admin/final-exam/users/${user.userId}`).set(admin).expect(200)).body.types[0]).toMatchObject({ attemptsUsed: 1, archivedCount: 10 });
  });

  it("urinish tafsiloti: sarflangan vaqt, xato va javobsiz savollar; faol urinishda 409", async () => {
    const user = await newUser();
    await completeCourse(user.userId);
    const { id } = (await http().post("/final-exam").set(user.auth).send({ type: "Q20" }).expect(201)).body;
    await http().get(`/admin/final-exam/attempts/${id}`).expect(403);
    expect((await http().get(`/admin/final-exam/attempts/${id}`).set(admin).expect(409)).body.code).toBe("FINAL_EXAM_IN_PROGRESS");
    const rows = (await http().get(`/final-exam/attempts/${id}/questions`).set(user.auth).expect(200)).body as QuestionRow[];
    await http().post(`/final-exam/attempts/${id}/answers`).set(user.auth).send({ position: 0, optionId: await correctOf(rows[0].question.id) }).expect(200);
    await http().post(`/final-exam/attempts/${id}/answers`).set(user.auth).send({ position: 1, optionId: await wrongOf(rows[1].question.id) }).expect(200);
    await http().post(`/final-exam/attempts/${id}/finish`).set(user.auth).expect(200);

    const body = (await http().get(`/admin/final-exam/attempts/${id}`).set(admin).expect(200)).body;
    expect(body).toMatchObject({ id, userId: user.userId, status: "FINISHED", correct: 1, total: 20 });
    expect(body.durationSec).toBeGreaterThanOrEqual(0);
    expect(body.questions).toHaveLength(20);
    expect(body.questions[0]).toMatchObject({ position: 0, result: "correct", correctOptionId: await correctOf(rows[0].question.id) });
    expect(body.questions[1]).toMatchObject({ result: "wrong", selectedOptionId: await wrongOf(rows[1].question.id), correctOptionId: await correctOf(rows[1].question.id) });
    expect(body.questions[2]).toMatchObject({ result: "skipped", selectedOptionId: null });
    // Variantlar o'quvchiga ko'rsatilgan tartibda.
    expect(body.questions[1].options.map((o: { id: string }) => o.id)).toEqual(rows[1].question.options.map((o) => o.id));
    await http().get(`/admin/final-exam/attempts/00000000-0000-4000-8000-000000000000`).set(admin).expect(404);
  });
});
