import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService, hashToken } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { SAVED_LIMIT } from "../src/saved/saved.service";

const TOPIC_A = "e2e-topic-a";
const TOPIC_B = "e2e-topic-b";
const TOPIC_BULK = "e2e-topic-bulk";

let app: INestApplication;
let prisma: PrismaService;
let questionsA: { id: string; correctOptionId: string }[] = [];
let questionsB: { id: string; correctOptionId: string }[] = [];

async function createTopic(slug: string, count: number, textPrefix: string) {
  const topic = await prisma.topic.create({ data: { slug, title: slug } });
  const result: { id: string; correctOptionId: string }[] = [];
  for (let order = 1; order <= count; order++) {
    const q = await prisma.question.create({
      data: {
        topicId: topic.id,
        order,
        text: `${textPrefix} савол ${order}`,
        textRu: `${textPrefix} вопрос ${order}`,
        imageUrl: `http://example.test/q${order}.jpg`,
        keyword: `KALIT ${order}`,
        options: {
          create: [
            { text: "Биринчи", isCorrect: false },
            { text: "Иккинчи", isCorrect: true },
          ],
        },
      },
      include: { options: true },
    });
    result.push({ id: q.id, correctOptionId: q.options.find((o) => o.isCorrect)!.id });
  }
  return result;
}

// Sessiya to'g'ridan-to'g'ri servis orqali — POST /auth/session IP bo'yicha
// daqiqasiga 10 ta bilan cheklangan (endpointning o'zi alohida testlanadi).
async function newUser(): Promise<{ auth: { Authorization: string }; userId: string }> {
  const { token } = await app.get(AuthService).createAnonymousSession();
  const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  return { auth: { Authorization: `Bearer ${token}` }, userId: session.userId };
}

function save(auth: Record<string, string>, questionId: string, extra: object = {}) {
  return request(app.getHttpServer())
    .post("/saved")
    .set(auth)
    .send({ questionId, sourceMode: "practice", ...extra });
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  // main.ts bilan bir xil validatsiya sozlamalari.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);

  await prisma.user.deleteMany();
  await prisma.topic.deleteMany({ where: { slug: { startsWith: "e2e-" } } });
  questionsA = await createTopic(TOPIC_A, 6, "Светофор");
  questionsB = await createTopic(TOPIC_B, 2, "Чорраҳа");
});

afterAll(async () => {
  await app?.close();
});

describe("auth", () => {
  it.each([
    ["get", "/saved"],
    ["get", "/saved/ids"],
    ["get", "/saved/count"],
    ["get", "/saved/practice"],
    ["post", "/saved"],
    ["patch", "/saved/00000000-0000-4000-8000-000000000000"],
    ["delete", "/saved/00000000-0000-4000-8000-000000000000"],
  ] as const)("%s %s sessiyasiz — 401", async (method, path) => {
    await request(app.getHttpServer())[method](path).expect(401);
  });

  it("POST /auth/session yangi foydalanuvchi va token beradi (bazada faqat xesh)", async () => {
    const res = await request(app.getHttpServer()).post("/auth/session").expect(201);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThanOrEqual(40);
    const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(res.body.token) } });
    expect(session).not.toBeNull();
    expect(await prisma.session.count({ where: { tokenHash: res.body.token } })).toBe(0);
    await request(app.getHttpServer())
      .get("/saved/count")
      .set("Authorization", `Bearer ${res.body.token}`)
      .expect(200);
  });

  it("muddati o'tgan sessiya — 401", async () => {
    const { auth, userId } = await newUser();
    await prisma.session.updateMany({ where: { userId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await request(app.getHttpServer()).get("/saved/count").set(auth).expect(401);
  });

  it("soxta token — 401", async () => {
    await request(app.getHttpServer()).get("/saved/count").set("Authorization", "Bearer not-a-real-token").expect(401);
  });

  it("body'dagi userId qabul qilinmaydi — 400", async () => {
    const { auth } = await newUser();
    const res = await save(auth, questionsA[0].id, { userId: "someone-else" }).expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, error: "Bad Request" });
  });
});

describe("saqlash va o'chirish", () => {
  it("idempotent: birinchi 201, keyingisi 200 va o'sha yozuv", async () => {
    const { auth } = await newUser();
    const first = await save(auth, questionsA[0].id).expect(201);
    const second = await save(auth, questionsA[0].id).expect(200);
    expect(second.body).toEqual(first.body);
    expect(first.body).toMatchObject({ questionId: questionsA[0].id, topicSlug: TOPIC_A, sourceMode: "practice" });

    const count = await request(app.getHttpServer()).get("/saved/count").set(auth).expect(200);
    expect(count.body).toEqual({ total: 1, limit: SAVED_LIMIT, byTopic: [{ topicSlug: TOPIC_A, count: 1 }] });
  });

  it("parallel ikki so'rov — bitta yozuv", async () => {
    const { auth, userId } = await newUser();
    const results = await Promise.all([save(auth, questionsA[1].id), save(auth, questionsA[1].id)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(await prisma.savedQuestion.count({ where: { userId } })).toBe(1);
  });

  it("mavjud bo'lmagan savol — 404, noto'g'ri body — 400", async () => {
    const { auth } = await newUser();
    await save(auth, "00000000-0000-4000-8000-000000000000").expect(404);
    await save(auth, "not-a-uuid").expect(400);
    await save(auth, questionsA[0].id, { sourceMode: "quiz" }).expect(400);
    // Imtihon rejimida urinish majburiy.
    await save(auth, questionsA[0].id, { sourceMode: "exam" }).expect(400);
  });

  it("o'chirish idempotent — ikki marta 204", async () => {
    const { auth } = await newUser();
    await save(auth, questionsA[0].id).expect(201);
    await request(app.getHttpServer()).delete(`/saved/${questionsA[0].id}`).set(auth).expect(204);
    await request(app.getHttpServer()).delete(`/saved/${questionsA[0].id}`).set(auth).expect(204);
    const ids = await request(app.getHttpServer()).get("/saved/ids").set(auth).expect(200);
    expect(ids.body).toEqual({ ids: [] });
  });

  it("izoh: yangilash, tozalash, 500 belgidan uzun — 400, saqlanmagan — 404", async () => {
    const { auth } = await newUser();
    await save(auth, questionsA[0].id).expect(201);
    const patched = await request(app.getHttpServer())
      .patch(`/saved/${questionsA[0].id}`)
      .set(auth)
      .send({ note: "  Yashil — yurish mumkin  " })
      .expect(200);
    expect(patched.body.note).toBe("Yashil — yurish mumkin");

    const cleared = await request(app.getHttpServer()).patch(`/saved/${questionsA[0].id}`).set(auth).send({ note: "" });
    expect(cleared.body.note).toBeNull();

    await request(app.getHttpServer())
      .patch(`/saved/${questionsA[0].id}`)
      .set(auth)
      .send({ note: "x".repeat(501) })
      .expect(400);
    await request(app.getHttpServer()).patch(`/saved/${questionsA[1].id}`).set(auth).send({ note: "a" }).expect(404);
  });
});

describe("foydalanuvchilar izolyatsiyasi", () => {
  it("B foydalanuvchi A ning saqlanganlarini ko'rmaydi va o'zgartira olmaydi", async () => {
    const a = await newUser();
    const b = await newUser();
    await save(a.auth, questionsA[0].id).expect(201);
    await request(app.getHttpServer()).patch(`/saved/${questionsA[0].id}`).set(a.auth).send({ note: "A izohi" });

    const server = app.getHttpServer();
    expect((await request(server).get("/saved").set(b.auth)).body).toEqual({ items: [], nextCursor: null });
    expect((await request(server).get("/saved/ids").set(b.auth)).body).toEqual({ ids: [] });
    expect((await request(server).get("/saved/count").set(b.auth)).body.total).toBe(0);
    expect((await request(server).get("/saved/practice").set(b.auth)).body).toEqual([]);

    // B ning o'chirishi/izohi A ning yozuviga ta'sir qilmaydi.
    await request(server).delete(`/saved/${questionsA[0].id}`).set(b.auth).expect(204);
    await request(server).patch(`/saved/${questionsA[0].id}`).set(b.auth).send({ note: "hack" }).expect(404);

    const aList = await request(server).get("/saved").set(a.auth).expect(200);
    expect(aList.body.items).toHaveLength(1);
    expect(aList.body.items[0].note).toBe("A izohi");
  });

  it("boshqa foydalanuvchining imtihon urinishi bilan saqlab bo'lmaydi — 404", async () => {
    const a = await newUser();
    const b = await newUser();
    const attempt = await prisma.examAttempt.create({ data: { userId: a.userId } });
    await save(b.auth, questionsA[0].id, { sourceMode: "exam", attemptId: attempt.id }).expect(404);
  });
});

describe("answerLocked", () => {
  it("yakunlanmagan imtihonda javob va kalit so'z yuborilmaydi, yakunlangach ochiladi", async () => {
    const { auth, userId } = await newUser();
    const attempt = await prisma.examAttempt.create({ data: { userId } });
    await save(auth, questionsA[0].id, { sourceMode: "exam", attemptId: attempt.id }).expect(201);
    await save(auth, questionsA[1].id).expect(201);

    const locked = await request(app.getHttpServer()).get("/saved").set(auth).expect(200);
    const examItem = locked.body.items.find((i: { questionId: string }) => i.questionId === questionsA[0].id);
    const practiceItem = locked.body.items.find((i: { questionId: string }) => i.questionId === questionsA[1].id);
    expect(examItem.answerLocked).toBe(true);
    expect(examItem).not.toHaveProperty("correctOptionId");
    expect(examItem).not.toHaveProperty("keyword");
    // Kalit so'z matni ham javobning hech bir joyida yo'q.
    expect(JSON.stringify(locked.body)).not.toContain("KALIT 1");
    expect(practiceItem).toMatchObject({ answerLocked: false, correctOptionId: questionsA[1].correctOptionId });
    expect(practiceItem.keyword).toEqual({ uz: "KALIT 2" });

    // Mashq testiga yopiq savol kirmaydi.
    const practice = await request(app.getHttpServer()).get("/saved/practice").set(auth).expect(200);
    expect(practice.body.map((q: { id: string }) => q.id)).toEqual([questionsA[1].id]);

    await prisma.examAttempt.update({ where: { id: attempt.id }, data: { finishedAt: new Date() } });
    const unlocked = await request(app.getHttpServer()).get("/saved").set(auth).expect(200);
    const opened = unlocked.body.items.find((i: { questionId: string }) => i.questionId === questionsA[0].id);
    expect(opened).toMatchObject({ answerLocked: false, correctOptionId: questionsA[0].correctOptionId });
  });
});

describe("ro'yxat: pagination, filtr, qidiruv", () => {
  it("kursor bo'yicha sahifalar — takrorsiz, eng yangisi birinchi; sort=old teskari", async () => {
    const { auth } = await newUser();
    const saved = questionsA.slice(0, 5).map((q) => q.id);
    for (const id of saved) await save(auth, id).expect(201);

    const seen: string[] = [];
    let cursor: string | null = null;
    const sizes: number[] = [];
    do {
      const res: request.Response = await request(app.getHttpServer())
        .get("/saved")
        .query({ limit: 2, ...(cursor ? { cursor } : {}) })
        .set(auth)
        .expect(200);
      sizes.push(res.body.items.length);
      seen.push(...res.body.items.map((i: { questionId: string }) => i.questionId));
      cursor = res.body.nextCursor;
    } while (cursor);

    expect(sizes).toEqual([2, 2, 1]);
    expect(seen).toEqual([...saved].reverse());

    const oldest = await request(app.getHttpServer()).get("/saved").query({ sort: "old", limit: 2 }).set(auth);
    expect(oldest.body.items.map((i: { questionId: string }) => i.questionId)).toEqual(saved.slice(0, 2));

    await request(app.getHttpServer()).get("/saved").query({ cursor: "garbage" }).set(auth).expect(400);
    await request(app.getHttpServer()).get("/saved").query({ limit: 51 }).set(auth).expect(400);
    await request(app.getHttpServer()).get("/saved").query({ lang: "en" }).set(auth).expect(400);
  });

  it("mavzu filtri va qidiruv (rus tilida — ruscha matn bo'yicha)", async () => {
    const { auth } = await newUser();
    await save(auth, questionsA[0].id).expect(201);
    await save(auth, questionsA[2].id).expect(201);
    await save(auth, questionsB[0].id).expect(201);

    const server = app.getHttpServer();
    const byTopic = await request(server).get("/saved").query({ topicSlug: TOPIC_B }).set(auth);
    expect(byTopic.body.items.map((i: { questionId: string }) => i.questionId)).toEqual([questionsB[0].id]);

    const ids = await request(server).get("/saved/ids").query({ topicSlug: TOPIC_A }).set(auth);
    expect(new Set(ids.body.ids)).toEqual(new Set([questionsA[0].id, questionsA[2].id]));

    const uz = await request(server).get("/saved").query({ q: "светофор савол 3", lang: "uz-cyrl" }).set(auth);
    expect(uz.body.items.map((i: { questionId: string }) => i.questionId)).toEqual([questionsA[2].id]);

    const ru = await request(server).get("/saved").query({ q: "чорраҳа ВОПРОС", lang: "ru" }).set(auth);
    expect(ru.body.items.map((i: { questionId: string }) => i.questionId)).toEqual([questionsB[0].id]);

    const count = await request(server).get("/saved/count").set(auth);
    expect(count.body.byTopic).toEqual([
      { topicSlug: TOPIC_A, count: 2 },
      { topicSlug: TOPIC_B, count: 1 },
    ]);
  });
});

describe("cheklovlar", () => {
  it(`${SAVED_LIMIT} tadan ortiq saqlab bo'lmaydi — 409 SAVED_LIMIT_REACHED`, async () => {
    const { auth, userId } = await newUser();
    const topic = await prisma.topic.create({ data: { slug: TOPIC_BULK, title: TOPIC_BULK } });
    await prisma.question.createMany({
      data: Array.from({ length: SAVED_LIMIT }, (_, i) => ({
        topicId: topic.id,
        order: i + 1,
        text: `bulk ${i}`,
        imageUrl: "http://example.test/bulk.jpg",
        keyword: "",
      })),
    });
    const bulk = await prisma.question.findMany({ where: { topicId: topic.id }, select: { id: true } });
    await prisma.savedQuestion.createMany({
      data: bulk.map((q) => ({ userId, questionId: q.id, topicId: topic.id })),
    });

    const res = await save(auth, questionsA[0].id).expect(409);
    expect(res.body).toMatchObject({ statusCode: 409, code: "SAVED_LIMIT_REACHED" });
    // Allaqachon saqlangan savolni qayta yuborish limitga qaramay 200.
    await save(auth, bulk[0].id).expect(200);
  });

  it("rate limit: daqiqasiga 60 ta o'zgartirish, keyin 429", async () => {
    const { auth } = await newUser();
    const server = app.getHttpServer();
    for (let i = 0; i < 60; i++) {
      await request(server).delete(`/saved/${questionsA[0].id}`).set(auth).expect(204);
    }
    await request(server).delete(`/saved/${questionsA[0].id}`).set(auth).expect(429);
    // Boshqa foydalanuvchining limiti alohida.
    const other = await newUser();
    await request(server).delete(`/saved/${questionsA[0].id}`).set(other.auth).expect(204);
  });
});
