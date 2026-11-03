import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { reviewAllKeywords } from "./helpers/keywords";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// To'g'ri javobi belgilanmagan savol (javobsiz import qilingan, answerPending):
// o'quvchiga ko'rinmaydi, natijaga ta'sir qilmaydi; admin javobni belgilab
// "Tugatdim" bosgach — testda.
const SLUG = "day9-topic98";
const ADMIN = "e2e-pendingadmin";
const PASSWORD = "Pending-Admin-Pass-77";

let app: INestApplication;
let prisma: PrismaService;
let auth: { Authorization: string };
let answered: { id: string; correct: string };
let unanswered: { id: string; option: string };
let admin: Record<string, string>;

function http() {
  return request(app.getHttpServer());
}

beforeAll(async () => {
  await configureAdminEnv();
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
    data: { topicId: topic.id, order: 2, text: "Javobsiz", keyword: "", needsReview: true, answerPending: true, options: { create: [{ order: 1, text: "A" }, { order: 2, text: "B" }] } },
    include: { options: true },
  });
  answered = { id: q1.id, correct: q1.options.find((o) => o.isCorrect)!.id };
  unanswered = { id: q2.id, option: q2.options[0].id };
  const { token } = await app.get(AuthService).createAnonymousSession();
  auth = { Authorization: `Bearer ${token}` };
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.40.0.1");
});

afterAll(async () => {
  await prisma.topic.deleteMany({ where: { slug: SLUG } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  await app.close();
});

describe("javobi belgilanmagan savollar", () => {
  it("test savollari ro'yxatida yo'q", async () => {
    await reviewAllKeywords(app, auth, SLUG);
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

  it("javob belgilansa ham \"Tugatdim\"gacha ko'rinmaydi; keyin — testda, ogohlantirish yo'qoladi", async () => {
    const before = await http().get("/admin/content/pending").set(admin).expect(200);
    const mine = () => (before.body as { topics: { slug: string; total: number; answered: number }[] }).topics.find((t) => t.slug === SLUG);
    expect(mine()).toMatchObject({ total: 1, answered: 0 });

    await prisma.option.update({ where: { id: unanswered.option }, data: { isCorrect: true } });
    let res = await http().get(`/topics/${SLUG}/questions`).set(auth).expect(200);
    expect((res.body as { id: string }[]).map((q) => q.id)).toEqual([answered.id]);
    await http().post(`/questions/${unanswered.id}/check-answer`).set(auth).send({ optionId: unanswered.option }).expect(404);
    const mid = await http().get("/admin/content/pending").set(admin).expect(200);
    expect((mid.body as { topics: { slug: string; answered: number }[] }).topics.find((t) => t.slug === SLUG)?.answered).toBe(1);

    const pub = await http().post("/admin/content/pending/publish").set(admin).expect(200);
    expect((pub.body as { published: number }).published).toBeGreaterThanOrEqual(1);
    await reviewAllKeywords(app, auth, SLUG);
    res = await http().get(`/topics/${SLUG}/questions`).set(auth).expect(200);
    expect((res.body as { id: string }[]).map((q) => q.id)).toEqual([answered.id, unanswered.id]);
    const counts = await http().get("/topics/ready-counts").set(auth).expect(200);
    expect((counts.body as Record<string, number>)[SLUG]).toBe(2);
    const after = await http().get("/admin/content/pending").set(admin).expect(200);
    expect((after.body as { topics: { slug: string }[] }).topics.some((t) => t.slug === SLUG)).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: "content.pending_published" } })).toBeGreaterThan(0);
  });

  it("oddiy foydalanuvchi \"Tugatdim\"ni bosa olmaydi", async () => {
    await http().post("/admin/content/pending/publish").set(auth).expect(403);
  });
});
