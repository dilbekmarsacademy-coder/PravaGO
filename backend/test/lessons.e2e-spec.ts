import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService, hashToken } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { LESSONS, type LessonConfig } from "../src/lessons/lessons.config";

// Real video xaritasi kontentga bog'liq (bo'sh bo'lishi ham mumkin) — test
// o'zining soxta darsini xaritaga vaqtincha qo'shadi.
const LESSON_ID = "e2e-lesson";
const LESSON: LessonConfig = { videoId: "e2eVideoId0", durationSec: 1535, topicSlug: "e2e-lesson-topic" };
const LESSON_MAP = LESSONS as Record<string, LessonConfig>;

let app: INestApplication;
let prisma: PrismaService;
let createdTopic = false;

async function newUser(): Promise<{ auth: { Authorization: string }; userId: string }> {
  const { token } = await app.get(AuthService).createAnonymousSession();
  const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  return { auth: { Authorization: `Bearer ${token}` }, userId: session.userId };
}

function report(auth: object, body: object) {
  return request(app.getHttpServer()).post(`/lessons/${LESSON_ID}/progress`).set(auth).send(body);
}

/** Oxirgi hisobotni `seconds` oldinga surib, real vaqt o'tganini taqlid qiladi. */
async function elapse(userId: string, seconds: number) {
  await prisma.lessonProgress.update({
    where: { userId_lessonId: { userId, lessonId: LESSON_ID } },
    data: { lastReportAt: new Date(Date.now() - seconds * 1000) },
  });
}

/**
 * Videoni halol "ko'radi": har 60 s real vaqtda `perMinute` soniya video
 * (1.5x = 90, 2x = 120; daqiqalik limitga sig'adi).
 */
async function watchHonestly(auth: object, userId: string, until: number, perMinute = 90) {
  let position = 0;
  let body: Record<string, unknown> = {};
  while (position < until) {
    const step = Math.min(perMinute, until - position);
    position += step;
    if (position > step) await elapse(userId, 60);
    body = (await report(auth, { position, maxPosition: position, watchedDelta: step }).expect(200)).body;
  }
  return body;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  LESSON_MAP[LESSON_ID] = LESSON;

  const existing = await prisma.topic.findUnique({ where: { slug: LESSON.topicSlug } });
  if (!existing) {
    createdTopic = true;
    await prisma.topic.create({
      data: {
        slug: LESSON.topicSlug,
        title: "e2e lesson topic",
        questions: {
          create: {
            order: 1,
            text: "Савол",
            imageUrl: "http://example.test/q.jpg",
            keyword: "KALIT",
            options: { create: [{ text: "А", isCorrect: true }, { text: "Б" }] },
          },
        },
      },
    });
  }
});

afterAll(async () => {
  await prisma.lessonProgress.deleteMany();
  if (createdTopic) await prisma.topic.delete({ where: { slug: LESSON.topicSlug } });
  delete LESSON_MAP[LESSON_ID];
  await app.close();
});

describe("video manbai", () => {
  it("sessiyasiz — 401", async () => {
    await request(app.getHttpServer()).get(`/lessons/${LESSON_ID}/video`).expect(401);
    await request(app.getHttpServer()).get(`/lessons/${LESSON_ID}`).expect(401);
    await request(app.getHttpServer()).post(`/lessons/${LESSON_ID}/progress`).send({}).expect(401);
  });

  it("sessiya bilan — video ID, noma'lum dars — 404", async () => {
    const { auth } = await newUser();
    const res = await request(app.getHttpServer()).get(`/lessons/${LESSON_ID}/video`).set(auth).expect(200);
    expect(res.body).toEqual({ videoId: LESSON.videoId });
    await request(app.getHttpServer()).get("/lessons/no-such-lesson/video").set(auth).expect(404);
    await request(app.getHttpServer()).get("/lessons/__proto__/video").set(auth).expect(400);
  });
});

describe("progress va test qulfi", () => {
  it("yangi foydalanuvchi: 0%, test savollari — 403", async () => {
    const { auth } = await newUser();
    const status = await request(app.getHttpServer()).get(`/lessons/${LESSON_ID}`).set(auth).expect(200);
    expect(status.body).toMatchObject({ watchedPercent: 0, completed: false, durationSec: LESSON.durationSec });

    const locked = await request(app.getHttpServer())
      .get(`/topics/${LESSON.topicSlug}/questions`)
      .set(auth)
      .expect(403);
    expect(locked.body).toMatchObject({ code: "LESSON_NOT_COMPLETED", lessonId: LESSON_ID });
    // Sessiyasiz ham ochilmaydi.
    await request(app.getHttpServer()).get(`/topics/${LESSON.topicSlug}/questions`).expect(403);
  });

  it("bitta soxta hisobot bilan butun videoni 'ko'rib' bo'lmaydi", async () => {
    const { auth } = await newUser();
    const res = await report(auth, {
      position: LESSON.durationSec,
      maxPosition: LESSON.durationSec,
      watchedDelta: LESSON.durationSec,
    }).expect(200);
    expect(res.body.completed).toBe(false);
    // Birinchi hisobot: ko'pi bilan 60 s × 2x + 2 s zaxira.
    expect(res.body.maxPosition).toBeLessThanOrEqual(122);
    expect(res.body.watchedSeconds).toBeLessThanOrEqual(122);
    expect(res.body.watchedPercent).toBe(Math.floor((res.body.maxPosition / LESSON.durationSec) * 100));
    // Davom ettirish nuqtasi ko'rilgan qismdan oshmaydi.
    expect(res.body.position).toBeLessThanOrEqual(res.body.maxPosition);
  });

  it("tez-tez yuborilgan hisobotlar real vaqtdan tez hisoblanmaydi", async () => {
    const { auth } = await newUser();
    await report(auth, { position: 10, maxPosition: 10, watchedDelta: 10 }).expect(200);
    // Darhol (≈0 s o'tib) yana 500 s "ko'rdim" — faqat zaxira (2 s) qo'shiladi.
    const res = await report(auth, { position: 510, maxPosition: 510, watchedDelta: 500 }).expect(200);
    expect(res.body.watchedSeconds).toBeLessThan(13);
    expect(res.body.maxPosition).toBeLessThan(13);
  });

  it("oxirigacha yetmasa — ko'rilmagan", async () => {
    const { auth, userId } = await newUser();
    const body = await watchHonestly(auth, userId, LESSON.durationSec - 60);
    expect(body.completed).toBe(false);
    await request(app.getHttpServer()).get(`/topics/${LESSON.topicSlug}/questions`).set(auth).expect(403);
  });

  it("halol ko'rilgan dars — ko'rildi, test ochiladi", async () => {
    const { auth, userId } = await newUser();
    const body = await watchHonestly(auth, userId, LESSON.durationSec);
    expect(body).toMatchObject({ completed: true, watchedPercent: 100 });

    const questions = await request(app.getHttpServer())
      .get(`/topics/${LESSON.topicSlug}/questions`)
      .set(auth)
      .expect(200);
    expect(questions.body.length).toBeGreaterThan(0);

    // Boshqa foydalanuvchiga ta'sir qilmaydi.
    const other = await newUser();
    await request(app.getHttpServer()).get(`/topics/${LESSON.topicSlug}/questions`).set(other.auth).expect(403);
  });

  it("2x tezlikda oxirigacha ko'rilgan dars ham ko'rildi", async () => {
    const { auth, userId } = await newUser();
    const body = await watchHonestly(auth, userId, LESSON.durationSec, 120);
    expect(body).toMatchObject({ completed: true, watchedPercent: 100 });
  });

  it("2x dan tez sakrash qabul qilinmaydi", async () => {
    const { auth, userId } = await newUser();
    await report(auth, { position: 100, maxPosition: 100, watchedDelta: 100 }).expect(200);
    await elapse(userId, 30);
    // 30 s ichida 2x bilan ko'pi bilan 60 s (+2 s zaxira) — 400 s ga sakrash kesiladi.
    const res = await report(auth, { position: 500, maxPosition: 500, watchedDelta: 400 }).expect(200);
    expect(res.body.maxPosition).toBeLessThanOrEqual(163);
  });

  it("darslar ro'yxati — har bir dars holati", async () => {
    const { auth, userId } = await newUser();
    await watchHonestly(auth, userId, 120);
    const res = await request(app.getHttpServer()).get("/lessons").set(auth).expect(200);
    const mine = (res.body as { lessonId: string; watchedPercent: number }[]).find((s) => s.lessonId === LESSON_ID);
    expect(mine?.watchedPercent).toBe(Math.floor((120 / LESSON.durationSec) * 100));
    expect(JSON.stringify(res.body)).not.toContain(LESSON.videoId);
  });

  it("noto'g'ri qiymatlar — 400", async () => {
    const { auth } = await newUser();
    await report(auth, { position: -1, maxPosition: 0, watchedDelta: 0 }).expect(400);
    await report(auth, { position: 0, maxPosition: 0, watchedDelta: "1" }).expect(400);
    await report(auth, { position: 0, maxPosition: 0, watchedDelta: 0, completed: true }).expect(400);
  });
});
