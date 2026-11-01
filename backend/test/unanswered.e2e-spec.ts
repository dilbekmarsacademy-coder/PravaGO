import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";

// To'g'ri javobi belgilanmagan savol (javobsiz import qilingan): o'quvchiga
// ko'rinmaydi, natijaga ta'sir qilmaydi; admin javobni belgilagach — testda.
const SLUG = "e2e-unanswered-topic";

let app: INestApplication;
let prisma: PrismaService;
let auth: { Authorization: string };
let answered: { id: string; correct: string };
let unanswered: { id: string; option: string };

function http() {
  return request(app.getHttpServer());
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await prisma.topic.deleteMany({ where: { slug: SLUG } });
  const topic = await prisma.topic.create({ data: { slug: SLUG, title: SLUG } });
  const q1 = await prisma.question.create({
    data: { topicId: topic.id, order: 1, text: "Javobli", keyword: "", options: { create: [{ order: 1, text: "A", isCorrect: true }, { order: 2, text: "B" }] } },
    include: { options: true },
  });
  const q2 = await prisma.question.create({
    data: { topicId: topic.id, order: 2, text: "Javobsiz", keyword: "", needsReview: true, options: { create: [{ order: 1, text: "A" }, { order: 2, text: "B" }] } },
    include: { options: true },
  });
  answered = { id: q1.id, correct: q1.options.find((o) => o.isCorrect)!.id };
  unanswered = { id: q2.id, option: q2.options[0].id };
  const { token } = await app.get(AuthService).createAnonymousSession();
  auth = { Authorization: `Bearer ${token}` };
});

afterAll(async () => {
  await prisma.topic.deleteMany({ where: { slug: SLUG } });
  await app.close();
});

describe("javobi belgilanmagan savollar", () => {
  it("test savollari ro'yxatida yo'q", async () => {
    const res = await http().get(`/topics/${SLUG}/questions`).set(auth).expect(200);
    expect((res.body as { id: string }[]).map((q) => q.id)).toEqual([answered.id]);
  });

  it("javobini tekshirib bo'lmaydi (404), kalit so'zlar ro'yxatida ham yo'q", async () => {
    await http().post(`/questions/${unanswered.id}/check-answer`).set(auth).send({ optionId: unanswered.option }).expect(404);
    const kw = await http().get(`/topics/${SLUG}/keywords`).set(auth).expect(200);
    expect((kw.body as { total: number }).total).toBe(1);
  });

  it("natija maxrajiga kirmaydi: javobli savolning hammasi to'g'ri — 100%", async () => {
    const res = await http()
      .post(`/topics/${SLUG}/attempts`)
      .set(auth)
      .send({ answers: [{ questionId: answered.id, optionId: answered.correct }, { questionId: unanswered.id, optionId: unanswered.option }] })
      .expect(201);
    expect(res.body).toMatchObject({ correct: 1, total: 1, percent: 100 });
  });

  it("ready-counts faqat javobli savollarni sanaydi", async () => {
    const res = await http().get("/topics/ready-counts").set(auth).expect(200);
    expect((res.body as Record<string, number>)[SLUG]).toBe(1);
  });

  it("admin javobni belgilagach savol testga qo'shiladi", async () => {
    await prisma.option.update({ where: { id: unanswered.option }, data: { isCorrect: true } });
    const res = await http().get(`/topics/${SLUG}/questions`).set(auth).expect(200);
    expect((res.body as { id: string }[]).map((q) => q.id)).toEqual([answered.id, unanswered.id]);
    const counts = await http().get("/topics/ready-counts").set(auth).expect(200);
    expect((counts.body as Record<string, number>)[SLUG]).toBe(2);
  });
});
