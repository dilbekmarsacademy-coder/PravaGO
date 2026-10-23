import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService, hashToken } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { LESSONS, type LessonConfig } from "../src/lessons/lessons.config";

// Kalit so'zli test banki: test API faqat savol/variantlarni beradi, javob
// tekshiruvi va "Kalit so'zlar" bo'limi esa kirish huquqi bilan ochiladi.
const TOPIC = "e2e-kw-topic";
const LOCKED_TOPIC = "e2e-kw-locked";
const LESSON_ID = "e2e-kw-lesson";
const LESSON_MAP = LESSONS as Record<string, LessonConfig>;

let app: INestApplication;
let prisma: PrismaService;
let withKeywords: { id: string; correctOptionId: string; wrongOptionId: string };
let withoutKeywords: { id: string; correctOptionId: string };
let lockedQuestionId: string;

async function newUser(): Promise<{ auth: { Authorization: string }; userId: string }> {
  const { token } = await app.get(AuthService).createAnonymousSession();
  const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  return { auth: { Authorization: `Bearer ${token}` }, userId: session.userId };
}

function http() {
  return request(app.getHttpServer());
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  LESSON_MAP[LESSON_ID] = { videoId: "e2eKwVideo0", durationSec: 600, topicSlug: LOCKED_TOPIC };

  await prisma.topic.deleteMany({ where: { slug: { in: [TOPIC, LOCKED_TOPIC] } } });
  const topic = await prisma.topic.create({ data: { slug: TOPIC, title: TOPIC } });
  // To'g'ri javob ATAYLAB birinchi emas.
  const q1 = await prisma.question.create({
    data: {
      topicId: topic.id,
      order: 1,
      text: "Ҳаракатланиш тақиқланади:",
      textLatn: "Harakatlanish taqiqlanadi:",
      textRu: "Движение запрещено:",
      imageUrl: "/images/e2e-q1.webp",
      keyword: "KO'K",
      options: {
        create: [
          { order: 1, text: "Қизил автомобилга", textLatn: "Qizil avtomobilga", textRu: "Красному автомобилю" },
          { order: 2, text: "Кўк автомобилга", textLatn: "Koʻk avtomobilga", textRu: "Синему автомобилю", isCorrect: true },
        ],
      },
      keywords: {
        create: {
          source: "html",
          questionText: "TAQIQLANADI",
          questionTextCyrl: "ТАҚИҚЛАНАДИ",
          questionTextRu: "ЗАПРЕЩЕНО",
          answerText: "KOʻK",
          answerTextCyrl: "КЎК",
          answerTextRu: "СИНЕМУ",
          highlights: {
            question: { uz: [14, 25], cyrl: [14, 25], ru: [9, 18] },
            answer: { uz: [0, 4], cyrl: [0, 3], ru: [0, 6] },
          },
        },
      },
    },
    include: { options: true },
  });
  withKeywords = {
    id: q1.id,
    correctOptionId: q1.options.find((o) => o.isCorrect)!.id,
    wrongOptionId: q1.options.find((o) => !o.isCorrect)!.id,
  };
  const q2 = await prisma.question.create({
    data: {
      topicId: topic.id,
      order: 2,
      text: "Расмсиз савол",
      imageUrl: null,
      keyword: "",
      options: { create: [{ order: 1, text: "Ҳа", isCorrect: true }, { order: 2, text: "Йўқ" }] },
      keywords: { create: { source: "none" } },
    },
    include: { options: true },
  });
  withoutKeywords = { id: q2.id, correctOptionId: q2.options.find((o) => o.isCorrect)!.id };

  const locked = await prisma.topic.create({
    data: {
      slug: LOCKED_TOPIC,
      title: LOCKED_TOPIC,
      questions: {
        create: {
          order: 1,
          text: "Қулфланган савол",
          imageUrl: null,
          keyword: "",
          options: { create: [{ order: 1, text: "А", isCorrect: true }, { order: 2, text: "Б" }] },
        },
      },
    },
    include: { questions: true },
  });
  lockedQuestionId = locked.questions[0].id;
});

afterAll(async () => {
  await prisma.topic.deleteMany({ where: { slug: { in: [TOPIC, LOCKED_TOPIC] } } });
  delete LESSON_MAP[LESSON_ID];
  await app?.close();
});

describe("test API", () => {
  it("sessiyasiz — 401", async () => {
    await http().get(`/topics/${TOPIC}/questions`).expect(401);
    await http().post(`/questions/${withKeywords.id}/check-answer`).send({ optionId: withKeywords.correctOptionId }).expect(401);
    await http().get(`/topics/${TOPIC}/keywords`).expect(401);
  });

  it("savollar ro'yxatida to'g'ri javob va kalit so'z yo'q, variantlar manba tartibida", async () => {
    const { auth } = await newUser();
    const res = await http().get(`/topics/${TOPIC}/questions`).set(auth).expect(200);
    const json = JSON.stringify(res.body);
    for (const leaked of ["isCorrect", "correctOptionId", "keyword", "TAQIQLANADI", "highlight"]) {
      expect(json).not.toContain(leaked);
    }
    expect(res.body[0].text).toEqual({ cyrl: "Ҳаракатланиш тақиқланади:", uz: "Harakatlanish taqiqlanadi:", ru: "Движение запрещено:" });
    expect(res.body[0].options.map((o: { text: { cyrl: string } }) => o.text.cyrl)).toEqual(["Қизил автомобилга", "Кўк автомобилга"]);
    expect(res.body[0].imageUrl).toBe("/images/e2e-q1.webp");
    expect(res.body[1].imageUrl).toBeNull();
  });

  it("javob backend'da tekshiriladi va kalit so'zlar qaytadi", async () => {
    const { auth } = await newUser();
    const wrong = await http()
      .post(`/questions/${withKeywords.id}/check-answer`)
      .set(auth)
      .send({ optionId: withKeywords.wrongOptionId })
      .expect(200);
    expect(wrong.body).toMatchObject({ correct: false, correctOptionId: withKeywords.correctOptionId });
    expect(wrong.body.keywords).toEqual({
      question: { text: { uz: "TAQIQLANADI", cyrl: "ТАҚИҚЛАНАДИ", ru: "ЗАПРЕЩЕНО" }, highlight: { uz: [14, 25], cyrl: [14, 25], ru: [9, 18] } },
      answer: { text: { uz: "KOʻK", cyrl: "КЎК", ru: "СИНЕМУ" }, highlight: { uz: [0, 4], cyrl: [0, 3], ru: [0, 6] } },
    });

    const right = await http()
      .post(`/questions/${withKeywords.id}/check-answer`)
      .set(auth)
      .send({ optionId: withKeywords.correctOptionId })
      .expect(200);
    expect(right.body.correct).toBe(true);
  });

  it("kalit so'zi yo'q savol — keywords: null", async () => {
    const { auth } = await newUser();
    const res = await http()
      .post(`/questions/${withoutKeywords.id}/check-answer`)
      .set(auth)
      .send({ optionId: withoutKeywords.correctOptionId })
      .expect(200);
    expect(res.body).toMatchObject({ correct: true, keywords: null });
  });

  it("video ko'rilmagan mavzu — javob ham tekshirilmaydi", async () => {
    const { auth } = await newUser();
    const optionId = (await prisma.option.findFirstOrThrow({ where: { questionId: lockedQuestionId } })).id;
    const res = await http().post(`/questions/${lockedQuestionId}/check-answer`).set(auth).send({ optionId }).expect(403);
    expect(res.body).toMatchObject({ code: "LESSON_NOT_COMPLETED" });
  });
});

describe("Kalit so'zlar bo'limi", () => {
  it("barcha savollar, kalit so'zi yo'qlari ham", async () => {
    const { auth } = await newUser();
    const res = await http().get(`/topics/${TOPIC}/keywords`).set(auth).expect(200);
    expect(res.body).toMatchObject({ total: 2, reviewedCount: 0 });
    expect(res.body.items[0]).toMatchObject({
      id: withKeywords.id,
      order: 1,
      correctAnswer: { cyrl: "Кўк автомобилга", uz: "Koʻk avtomobilga", ru: "Синему автомобилю" },
      reviewed: false,
    });
    expect(res.body.items[0].keywords.answer.highlight.cyrl).toEqual([0, 3]);
    expect(res.body.items[1]).toMatchObject({ id: withoutKeywords.id, keywords: null, imageUrl: null });
  });

  it("'ko'rib chiqdim' foydalanuvchiga bog'lab saqlanadi va idempotent", async () => {
    const { auth } = await newUser();
    const url = `/topics/${TOPIC}/keywords/${withKeywords.id}/review`;
    expect((await http().put(url).set(auth).send({ reviewed: true }).expect(200)).body).toMatchObject({ reviewed: true, reviewedCount: 1, total: 2 });
    await http().put(url).set(auth).send({ reviewed: true }).expect(200);
    const list = await http().get(`/topics/${TOPIC}/keywords`).set(auth).expect(200);
    expect(list.body.reviewedCount).toBe(1);
    expect(list.body.items[0].reviewed).toBe(true);

    // Boshqa foydalanuvchiga ta'sir qilmaydi.
    const other = await newUser();
    expect((await http().get(`/topics/${TOPIC}/keywords`).set(other.auth).expect(200)).body.reviewedCount).toBe(0);

    expect((await http().put(url).set(auth).send({ reviewed: false }).expect(200)).body).toMatchObject({ reviewed: false, reviewedCount: 0 });
    await http().put(url).set(auth).send({ reviewed: "yes" }).expect(400);
    await http().put(`/topics/${TOPIC}/keywords/${lockedQuestionId}/review`).set(auth).send({ reviewed: true }).expect(404);
  });

  it("kirish huquqi test bilan bir xil — video ko'rilmaguncha 403", async () => {
    const { auth } = await newUser();
    await http().get(`/topics/${LOCKED_TOPIC}/keywords`).set(auth).expect(403);
    await http().put(`/topics/${LOCKED_TOPIC}/keywords/${lockedQuestionId}/review`).set(auth).send({ reviewed: true }).expect(403);
    await http().get("/topics/no-such-topic/keywords").set(auth).expect(404);
  });
});

describe("Saqlanganlar", () => {
  it("to'g'ri javob va kalit so'zlar (yoki null) bilan", async () => {
    const { auth } = await newUser();
    await http().post("/saved").set(auth).send({ questionId: withKeywords.id, sourceMode: "practice" }).expect(201);
    await http().post("/saved").set(auth).send({ questionId: withoutKeywords.id, sourceMode: "practice" }).expect(201);
    const res = await http().get(`/saved?topicSlug=${TOPIC}`).set(auth).expect(200);
    const byId = new Map(res.body.items.map((i: { questionId: string }) => [i.questionId, i]));
    expect(byId.get(withKeywords.id)).toMatchObject({ correctOptionId: withKeywords.correctOptionId, keywords: { answer: { text: { uz: "KOʻK" } } } });
    expect(byId.get(withoutKeywords.id)).toMatchObject({ correctOptionId: withoutKeywords.correctOptionId, keywords: null });
  });
});

describe("Test natijalari (98% qoidasi uchun)", () => {
  it("foiz serverda hisoblanadi, klient yuborgan foiz yo'q", async () => {
    const { auth } = await newUser();
    const half = await http()
      .post(`/topics/${TOPIC}/attempts`)
      .set(auth)
      .send({
        answers: [
          { questionId: withKeywords.id, optionId: withKeywords.correctOptionId },
          // Takroriy javob ikkinchi marta hisoblanmaydi.
          { questionId: withKeywords.id, optionId: withKeywords.correctOptionId },
          // Boshqa mavzu savoli hisobga olinmaydi.
          { questionId: lockedQuestionId, optionId: withKeywords.correctOptionId },
        ],
      })
      .expect(201);
    expect(half.body).toMatchObject({ topicSlug: TOPIC, correct: 1, total: 2, percent: 50 });

    const full = await http()
      .post(`/topics/${TOPIC}/attempts`)
      .set(auth)
      .send({
        answers: [
          { questionId: withKeywords.id, optionId: withKeywords.correctOptionId },
          { questionId: withoutKeywords.id, optionId: withoutKeywords.correctOptionId },
        ],
      })
      .expect(201);
    expect(full.body.percent).toBe(100);

    const list = await http().get("/attempts").set(auth).expect(200);
    expect(list.body.map((a: { percent: number }) => a.percent)).toEqual([50, 100]);
    expect((await http().get("/attempts").set((await newUser()).auth).expect(200)).body).toEqual([]);
  });

  it("noto'g'ri so'rovlar va kirish huquqi", async () => {
    const { auth } = await newUser();
    await http().post(`/topics/${TOPIC}/attempts`).send({ answers: [] }).expect(401);
    await http().post(`/topics/${TOPIC}/attempts`).set(auth).send({ answers: [{ questionId: "x", optionId: "y" }] }).expect(400);
    await http().post(`/topics/${TOPIC}/attempts`).set(auth).send({ answers: [], percent: 100 }).expect(400);
    await http().post(`/topics/${LOCKED_TOPIC}/attempts`).set(auth).send({ answers: [] }).expect(403);
  });
});
