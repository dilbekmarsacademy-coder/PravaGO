import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// 6-kun savolini tahrirlash: validatsiya, kalit so'z diapazonlari, audit va
// foydalanuvchi API'sida to'g'ri javob/kalit so'z yashirinligi.
const SLUG = "day6-topic99";
// Kurs kunlari (1–7) hammasi ochiq; kursda yo'q kun — yopiq.
const LOCKED_SLUG = "day9-topic99";
const ADMIN = "e2e-content";
const PASSWORD = "Content-Admin-123";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
let questionId: string;
let lockedQuestionId: string;
let optionIds: string[];

function http() {
  return request(app.getHttpServer());
}

const TEXT = { cyrl: "Ҳаракатланиш тақиқланади:", latn: "Harakatlanish taqiqlanadi:", ru: "Движение запрещено:" };

function body(overrides: Record<string, unknown> = {}) {
  return {
    text: TEXT,
    options: [
      { id: optionIds[0], text: { cyrl: "Қизил автомобилга", latn: "Qizil avtomobilga", ru: "Красному" } },
      { id: optionIds[1], text: { cyrl: "Кўк автомобилга", latn: "Ko'k avtomobilga", ru: "Синему" } },
    ],
    correctIndex: 0,
    keywords: { none: false, question: { uz: [[14, 25]], cyrl: [[13, 24]], ru: [[9, 18]] }, answer: { uz: [[0, 5]], cyrl: [[0, 5]], ru: [[0, 8]] } },
    ...overrides,
  };
}

beforeAll(async () => {
  await configureAdminEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await prisma.topic.deleteMany({ where: { slug: { in: [SLUG, LOCKED_SLUG] } } });
  const topic = await prisma.topic.create({ data: { slug: SLUG, title: SLUG } });
  const q = await prisma.question.create({
    data: {
      topicId: topic.id,
      order: 1,
      text: TEXT.cyrl,
      textLatn: TEXT.latn,
      textRu: TEXT.ru,
      keyword: "",
      ruNeedsReview: true,
      options: { create: [{ order: 1, text: "Қизил автомобилга", textLatn: "Qizil avtomobilga" }, { order: 2, text: "Кўк автомобилга", textLatn: "Ko'k avtomobilga", isCorrect: true }] },
    },
    include: { options: { orderBy: { order: "asc" } } },
  });
  questionId = q.id;
  optionIds = q.options.map((o) => o.id);
  const locked = await prisma.topic.create({ data: { slug: LOCKED_SLUG, title: LOCKED_SLUG } });
  lockedQuestionId = (await prisma.question.create({ data: { topicId: locked.id, order: 1, text: "Савол", keyword: "", options: { create: [{ text: "А", isCorrect: true }, { text: "Б", order: 1 }] } } })).id;
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.30.0.1");
});

afterAll(async () => {
  await prisma.topic.deleteMany({ where: { slug: { in: [SLUG, LOCKED_SLUG] } } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  await app.close();
});

describe("admin kontent", () => {
  it("oddiy foydalanuvchi va proxy'siz so'rov — yopiq", async () => {
    const { token } = await app.get(AuthService).createAnonymousSession();
    await http().get(`/admin/questions/${questionId}`).set("Authorization", `Bearer ${token}`).expect(403);
    await http().put(`/admin/questions/${questionId}`).send(body()).expect(403);
  });

  it("kurs kunlari ochiq, kursdan tashqari kun yopiq (ADMIN_EDITABLE_DAYS)", async () => {
    await http().get(`/admin/questions/${lockedQuestionId}`).set(admin).expect(403);
    await http().get(`/admin/content/topics/${LOCKED_SLUG}/questions`).set(admin).expect(403);
    const res = await http().get(`/admin/content/topics/${SLUG}/questions?filter=needsReview`).set(admin).expect(200);
    expect((res.body as { items: { id: string }[] }).items.map((i) => i.id)).toEqual([questionId]);
  });

  it("validatsiya: variantlar < 2, to'g'ri javob chegaradan tashqarida, diapazon matndan tashqarida", async () => {
    await http().put(`/admin/questions/${questionId}`).set(admin).send(body({ options: [body().options[0]] })).expect(400);
    await http().put(`/admin/questions/${questionId}`).set(admin).send(body({ correctIndex: 2 })).expect(400);
    await http().put(`/admin/questions/${questionId}`).set(admin).send(body({ correctIndex: -1 })).expect(400);
    await http()
      .put(`/admin/questions/${questionId}`)
      .set(admin)
      .send(body({ keywords: { none: false, question: { uz: [[14, 99]] } } }))
      .expect(400);
    await http()
      .put(`/admin/questions/${questionId}`)
      .set(admin)
      .send(body({ keywords: { none: false, question: { uz: [[0, 10], [5, 12]] } } }))
      .expect(400);
    await http().put(`/admin/questions/${questionId}`).set(admin).send(body({ keywords: { none: false } })).expect(400);
  });

  it("saqlaydi: to'g'ri javob, kalit so'z chip'i, audit; foydalanuvchi ro'yxatida javob yo'q", async () => {
    const res = await http().put(`/admin/questions/${questionId}`).set(admin).send(body()).expect(200);
    expect(res.body).toMatchObject({ correctIndex: 0, keywords: { none: false, question: { uz: [[14, 25]] } } });
    const kw = await prisma.questionKeyword.findUniqueOrThrow({ where: { questionId } });
    expect(kw).toMatchObject({ questionText: "TAQIQLANADI", questionTextCyrl: "ТАҚИҚЛАНАДИ", answerText: "QIZIL", source: "admin", needsReview: false });
    const options = await prisma.option.findMany({ where: { questionId }, orderBy: { order: "asc" } });
    expect(options.map((o) => o.isCorrect)).toEqual([true, false]);
    expect(options.map((o) => o.id)).toEqual(optionIds);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: questionId, action: "question.updated" } });
    expect((audit.before as { correctIndex: number }).correctIndex).toBe(1);
    expect((audit.after as { correctIndex: number }).correctIndex).toBe(0);

    const { token } = await app.get(AuthService).createAnonymousSession();
    const list = await http().get(`/topics/${SLUG}/questions`).set("Authorization", `Bearer ${token}`).expect(200);
    const json = JSON.stringify(list.body);
    expect(json).not.toMatch(/isCorrect|correctOptionId|keyword|highlight/i);
    expect(list.headers["cache-control"]).toBe("no-store");
    const check = await http().post(`/questions/${questionId}/check-answer`).set("Authorization", `Bearer ${token}`).send({ optionId: optionIds[0] }).expect(200);
    expect(check.body).toMatchObject({ correct: true, keywords: { question: { text: { uz: "TAQIQLANADI" } } } });
  });

  it("variant qo'shish/o'chirish va 'kalit so'z mavjud emas'", async () => {
    const res = await http()
      .put(`/admin/questions/${questionId}`)
      .set(admin)
      .send(
        body({
          options: [
            { id: optionIds[1], text: { cyrl: "Кўк", latn: "Ko'k", ru: "Синему" } },
            { text: { cyrl: "Иккаласига", latn: "Ikkalasiga", ru: "Обоим" } },
            { text: { cyrl: "Ҳеч бирига", latn: "Hech biriga", ru: "Никому" } },
          ],
          correctIndex: 2,
          keywords: { none: true },
        }),
      )
      .expect(200);
    const out = res.body as { options: { id: string; isCorrect: boolean }[]; keywords: { none: boolean } };
    expect(out.options).toHaveLength(3);
    expect(out.options[0].id).toBe(optionIds[1]);
    expect(out.options.map((o) => o.isCorrect)).toEqual([false, false, true]);
    expect(out.keywords.none).toBe(true);
    expect(await prisma.option.count({ where: { id: optionIds[0] } })).toBe(0);
  });

  it("'Tekshirildi' — ruNeedsReview tozalanadi", async () => {
    const res = await http().post(`/admin/questions/${questionId}/reviewed`).set(admin).expect(200);
    expect(res.body).toMatchObject({ ruNeedsReview: false });
  });
});
