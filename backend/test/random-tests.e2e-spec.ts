import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService, hashToken } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { selectQuestions } from "../src/random-tests/selection";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// "Random testlar": tanlash qoidalari, server taymeri, javob xavfsizligi, natija va admin.
const SLUGS = ["day7-topic81", "day7-topic82", "day7-topic83", "day7-topic84"];
const PER_TOPIC = 15;
const ADMIN = "e2e-random";
const PASSWORD = "Random-Tests-2026";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
const http = () => request(app.getHttpServer());

async function newUser(): Promise<{ auth: { Authorization: string }; userId: string }> {
  const { token } = await app.get(AuthService).createAnonymousSession();
  const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  return { auth: { Authorization: `Bearer ${token}` }, userId: session.userId };
}

type Chunk = { position: number; topicSlug: string; question: { id: string; options: { id: string }[] }; review: null | { correct: boolean; correctOptionId: string; selectedOptionId: string | null } }[];

async function allQuestions(auth: Record<string, string>, id: string, total: number): Promise<Chunk> {
  const out: Chunk = [];
  for (let from = 0; from < total; from += 25) out.push(...(await http().get(`/random-tests/${id}/questions?from=${from}&count=25`).set(auth).expect(200)).body);
  return out;
}

const correctOf = async (questionId: string) => (await prisma.option.findFirstOrThrow({ where: { questionId, isCorrect: true } })).id;
const wrongOf = async (questionId: string) => (await prisma.option.findFirstOrThrow({ where: { questionId, isCorrect: false } })).id;

beforeAll(async () => {
  process.env.PAYMENT_ENFORCED = "false";
  await configureAdminEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await prisma.topic.deleteMany({ where: { slug: { in: SLUGS } } });
  for (const slug of SLUGS) {
    const topic = await prisma.topic.create({ data: { slug, title: slug } });
    for (let i = 1; i <= PER_TOPIC; i++) {
      await prisma.question.create({
        data: {
          topicId: topic.id,
          order: i,
          text: `Савол ${slug} ${i}`,
          textLatn: `Savol ${slug} ${i}`,
          keyword: "",
          options: { create: [{ order: 1, text: "А", isCorrect: true }, { order: 2, text: "Б" }, { order: 3, text: "В" }] },
          keywords: { create: { questionText: "SAVOL", questionTextCyrl: "САВОЛ", answerText: "A", answerTextCyrl: "А", source: "html" } },
        },
      });
    }
  }
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.33.0.1");
});

afterAll(async () => {
  await prisma.topic.deleteMany({ where: { slug: { in: SLUGS } } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  await app.close();
});

describe("selectQuestions", () => {
  const pool = ["a", "b", "c", "d"].flatMap((t) => Array.from({ length: 10 }, (_, i) => ({ id: `${t}${i}`, topicId: t })));

  it("takrorsiz, mavzular bo'yicha teng, avval ko'rilmaganlar", () => {
    const ids = selectQuestions(pool, new Set(), 20);
    expect(new Set(ids).size).toBe(20);
    const perTopic = ["a", "b", "c", "d"].map((t) => ids.filter((id) => id.startsWith(t)).length);
    expect(perTopic).toEqual([5, 5, 5, 5]);
    const seen = new Set(pool.filter((q) => q.topicId !== "a").map((q) => q.id).slice(0, 25));
    const next = selectQuestions(pool, seen, 20);
    expect(next.filter((id) => !seen.has(id))).toHaveLength(15);
  });
});

describe("Random testlar", () => {
  let user: Awaited<ReturnType<typeof newUser>>;
  let first: { id: string; ids: string[] };

  it("sessiyasiz — 401; to'lov majburiy va to'lanmagan — 403 (Yangi testlar bilan bir xil qoida)", async () => {
    await http().get("/random-tests").expect(401);
    user = await newUser();
    process.env.PAYMENT_ENFORCED = "true";
    const res = await http().post("/random-tests").set(user.auth).send({ size: 20 }).expect(403);
    expect(res.body.code).toBe("PAYMENT_REQUIRED");
    process.env.PAYMENT_ENFORCED = "false";
    await http().post("/random-tests").set(user.auth).send({ size: 30 }).expect(400);
  });

  it("20 talik test: takrorsiz, mavzular aralash, to'g'ri javob yo'q, taymer serverda", async () => {
    const res = await http().post("/random-tests").set(user.auth).send({ size: 20 }).expect(201);
    expect(res.body).toMatchObject({ size: 20, total: 20, status: "in_progress", answered: 0 });
    expect(res.body.items).toHaveLength(20);
    expect(res.body.remainingMs).toBeGreaterThan(19 * 60_000);
    expect(new Date(res.body.deadlineAt).getTime() - new Date(res.body.startedAt).getTime()).toBe(20 * 60_000);

    const chunk = await allQuestions(user.auth, res.body.id, 20);
    const raw = JSON.stringify(chunk);
    expect(raw).not.toMatch(/isCorrect|correctOptionId|keyword/);
    const ids = chunk.map((c) => c.question.id);
    expect(new Set(ids).size).toBe(20);
    expect(chunk.map((c) => c.position)).toEqual([...Array(20).keys()]);
    expect(new Set(chunk.map((c) => c.topicSlug)).size).toBeGreaterThanOrEqual(3);
    // Variantlar — savolning o'z variantlari (tartibi aralash bo'lishi mumkin).
    for (const c of chunk.slice(0, 5)) {
      const own = (await prisma.option.findMany({ where: { questionId: c.question.id } })).map((o) => o.id).sort();
      expect(c.question.options.map((o) => o.id).sort()).toEqual(own);
    }
    // Sahifa yangilansa — tartib va variantlar o'zgarmaydi.
    expect(await allQuestions(user.auth, res.body.id, 20)).toEqual(chunk);
    first = { id: res.body.id, ids };
  });

  it("ikkinchi testni boshlab bo'lmaydi — tugallanmagani bor", async () => {
    const res = await http().post("/random-tests").set(user.auth).send({ size: 50 }).expect(409);
    expect(res.body).toMatchObject({ code: "RANDOM_TEST_ACTIVE", attemptId: first.id });
  });

  it("javob: bir marta, to'g'ri javob va kalit so'z faqat javobdan keyin; o'zgartirib bo'lmaydi", async () => {
    const q0 = first.ids[0];
    const ok = await http().post(`/random-tests/${first.id}/answers`).set(user.auth).send({ position: 0, optionId: await correctOf(q0) }).expect(200);
    expect(ok.body.review).toMatchObject({ correct: true, correctOptionId: await correctOf(q0), keywords: { question: { text: { uz: "SAVOL" } } } });
    expect(ok.body.state).toMatchObject({ answered: 1, correct: 1 });
    await http().post(`/random-tests/${first.id}/answers`).set(user.auth).send({ position: 0, optionId: await wrongOf(q0) }).expect(409);
    const bad = await http().post(`/random-tests/${first.id}/answers`).set(user.auth).send({ position: 1, optionId: await wrongOf(first.ids[1]) }).expect(200);
    expect(bad.body.review).toMatchObject({ correct: false, correctOptionId: await correctOf(first.ids[1]) });
    // Boshqa savolning varianti — 400.
    await http().post(`/random-tests/${first.id}/answers`).set(user.auth).send({ position: 2, optionId: await correctOf(first.ids[3]) }).expect(400);
    // Javob berilganlari qayta yuklashda natija bilan, qolganlari — natijasiz.
    const chunk = await allQuestions(user.auth, first.id, 3);
    expect(chunk[0].review).toMatchObject({ correct: true });
    expect(chunk[2].review).toBeNull();
  });

  it("boshqa foydalanuvchi urinishni ko'ra olmaydi va javob bera olmaydi", async () => {
    const other = await newUser();
    await http().get(`/random-tests/${first.id}`).set(other.auth).expect(404);
    await http().get(`/random-tests/${first.id}/questions`).set(other.auth).expect(404);
    await http().post(`/random-tests/${first.id}/answers`).set(other.auth).send({ position: 3, optionId: await correctOf(first.ids[3]) }).expect(404);
    await http().post(`/random-tests/${first.id}/finish`).set(other.auth).expect(404);
    expect((await http().get("/random-tests").set(other.auth).expect(200)).body.history).toEqual([]);
  });

  it("yakunlash: javobsizlar xato; natijada hamma savol to'g'ri javobi bilan", async () => {
    const res = await http().post(`/random-tests/${first.id}/finish`).set(user.auth).expect(200);
    expect(res.body).toMatchObject({ status: "finished", answered: 2, correct: 1, wrong: 1, unanswered: 18, percent: 5 });
    const chunk = await allQuestions(user.auth, first.id, 20);
    expect(chunk.every((c) => c.review && c.review.correctOptionId)).toBe(true);
    expect(chunk[5].review).toMatchObject({ selectedOptionId: null, correct: false });
    await http().post(`/random-tests/${first.id}/answers`).set(user.auth).send({ position: 5, optionId: await correctOf(first.ids[5]) }).expect(409);
  });

  it("keyingi test oldingisidagi savollarni takrorlamaydi (ko'rilmaganlar yetarli)", async () => {
    const res = await http().post("/random-tests").set(user.auth).send({ size: 20 }).expect(201);
    const ids = (await allQuestions(user.auth, res.body.id, 20)).map((c) => c.question.id);
    expect(ids.filter((id) => first.ids.includes(id))).toEqual([]);
    await http().post(`/random-tests/${res.body.id}/finish`).set(user.auth).expect(200);
  });

  it("vaqt tugasa: javob qabul qilinmaydi, test 'expired' bo'ladi", async () => {
    const res = await http().post("/random-tests").set(user.auth).send({ size: 50 }).expect(201);
    expect(res.body.total).toBe(50);
    const chunk = await allQuestions(user.auth, res.body.id, 1);
    await http().post(`/random-tests/${res.body.id}/answers`).set(user.auth).send({ position: 0, optionId: await correctOf(chunk[0].question.id) }).expect(200);
    await prisma.randomTestAttempt.update({ where: { id: res.body.id }, data: { deadlineAt: new Date(Date.now() - 1000) } });
    const late = await http().post(`/random-tests/${res.body.id}/answers`).set(user.auth).send({ position: 1, optionId: "x" }).expect(409);
    expect(late.body.code).toBe("RANDOM_TEST_TIME_UP");
    const state = (await http().get(`/random-tests/${res.body.id}`).set(user.auth).expect(200)).body;
    expect(state).toMatchObject({ status: "expired", remainingMs: 0, answered: 1, correct: 1, unanswered: 49, percent: 2 });
    const overview = (await http().get("/random-tests").set(user.auth).expect(200)).body;
    expect(overview.active).toBeNull();
    expect(overview.history.map((h: { id: string }) => h.id)).toContain(res.body.id);
  });

  it("bazada savol kam — tushunarli xato, rozilik bilan bor savollar bilan boshlanadi", async () => {
    const { available } = (await http().get("/random-tests").set(user.auth).expect(200)).body;
    if (available >= 200) return;
    const res = await http().post("/random-tests").set(user.auth).send({ size: 200 }).expect(409);
    expect(res.body).toMatchObject({ code: "RANDOM_TEST_NOT_ENOUGH", available });
    const started = await http().post("/random-tests").set(user.auth).send({ size: 200, allowFewer: true }).expect(201);
    expect(started.body).toMatchObject({ size: 200, total: available });
    const ids = (await allQuestions(user.auth, started.body.id, available)).map((c) => c.question.id);
    expect(new Set(ids).size).toBe(available);
    await http().post(`/random-tests/${started.body.id}/finish`).set(user.auth).expect(200);
  });

  it("bir vaqtda ikki so'rov — faqat bitta test yaratiladi", async () => {
    const racer = await newUser();
    const codes = (await Promise.all([1, 2].map(() => http().post("/random-tests").set(racer.auth).send({ size: 20 })))).map((r) => r.status).sort();
    expect(codes).toEqual([201, 409]);
  });

  it("admin: foydalanuvchi bo'yicha ro'yxat va savollar kesimida tafsilot", async () => {
    await http().get("/admin/random-tests").expect(403);
    const list = (await http().get(`/admin/random-tests?userId=${user.userId}`).set(admin).expect(200)).body;
    expect(list.items.length).toBeGreaterThanOrEqual(3);
    const row = list.items.find((i: { id: string }) => i.id === first.id);
    expect(row).toMatchObject({ size: 20, status: "finished", correct: 1, wrong: 1, unanswered: 18, percent: 5, user: { id: user.userId } });
    const detail = (await http().get(`/admin/random-tests/${first.id}`).set(admin).expect(200)).body;
    expect(detail.items).toHaveLength(20);
    expect(detail.items[0]).toMatchObject({ result: "correct", correctAnswer: "А", keyword: "SAVOL → A" });
    expect(detail.items[1].result).toBe("wrong");
    expect(detail.items[2].result).toBe("unanswered");
    const expired = (await http().get(`/admin/random-tests?userId=${user.userId}&status=expired`).set(admin).expect(200)).body;
    expect(expired.items.every((i: { status: string }) => i.status === "expired")).toBe(true);
  });
});
