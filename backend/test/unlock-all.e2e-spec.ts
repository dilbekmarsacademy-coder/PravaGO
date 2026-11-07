import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService, hashToken } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// Admin alohida o'quvchiga "hammasini ochadi": video va kalit so'z shartisiz test.
// Boshqa o'quvchilar uchun qoidalar o'zgarmaydi.
const SLUG = "day5-topic3"; // lessons.config'da darsi bor mavzu
const ADMIN = "e2e-unlockall";
const PASSWORD = "Unlock-All-2026";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
let questionId: string;
let correctOptionId: string;
const http = () => request(app.getHttpServer());

async function newUser() {
  const { token } = await app.get(AuthService).createAnonymousSession();
  const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  return { auth: { Authorization: `Bearer ${token}` }, userId: session.userId };
}

beforeAll(async () => {
  process.env.PAYMENT_ENFORCED = "false";
  await configureAdminEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await prisma.topic.deleteMany({ where: { slug: SLUG } });
  const topic = await prisma.topic.create({ data: { slug: SLUG, title: SLUG } });
  const q = await prisma.question.create({
    data: { topicId: topic.id, order: 1, text: "Савол", textLatn: "Savol", keyword: "", options: { create: [{ order: 1, text: "А", isCorrect: true }, { order: 2, text: "Б" }] } },
    include: { options: true },
  });
  questionId = q.id;
  correctOptionId = q.options.find((o) => o.isCorrect)!.id;
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.34.0.1");
});

afterAll(async () => {
  await prisma.topic.deleteMany({ where: { slug: SLUG } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  await app.close();
});

describe("Hammasini ochish (User.unlockAll)", () => {
  it("oddiy o'quvchi: video ko'rilmagan — test yopiq (o'zgarmagan qoida)", async () => {
    const user = await newUser();
    expect((await http().get(`/topics/${SLUG}/questions`).set(user.auth).expect(403)).body.code).toBe("LESSON_NOT_COMPLETED");
    expect((await http().get("/me").set(user.auth).expect(200)).body.unlockAll).toBe(false);
  });

  it("admin yoqqan o'quvchi: videosiz va kalit so'zsiz test, javob tekshiruvi; audit; o'chirilsa yana yopiq", async () => {
    const user = await newUser();
    await http().post(`/admin/users/${user.userId}/unlock-all`).send({ enabled: true }).expect(403);
    const res = await http().post(`/admin/users/${user.userId}/unlock-all`).set(admin).send({ enabled: true }).expect(200);
    expect(res.body).toEqual({ id: user.userId, unlockAll: true });
    expect(await prisma.auditLog.count({ where: { action: "user.unlock_all", entityId: user.userId } })).toBe(1);

    expect((await http().get("/me").set(user.auth).expect(200)).body.unlockAll).toBe(true);
    const questions = (await http().get(`/topics/${SLUG}/questions`).set(user.auth).expect(200)).body;
    expect(questions.map((q: { id: string }) => q.id)).toEqual([questionId]);
    const check = await http().post(`/questions/${questionId}/check-answer`).set(user.auth).send({ optionId: correctOptionId }).expect(200);
    expect(check.body.correct).toBe(true);
    // Video ko'rilgan deb yolg'on belgilanmaydi — haqiqiy progress o'zgarmaydi.
    expect(await prisma.lessonProgress.count({ where: { userId: user.userId } })).toBe(0);
    expect((await http().get(`/admin/users/${user.userId}`).set(admin).expect(200)).body.unlockAll).toBe(true);

    await http().post(`/admin/users/${user.userId}/unlock-all`).set(admin).send({ enabled: false }).expect(200);
    await http().get(`/topics/${SLUG}/questions`).set(user.auth).expect(403);
  });

  it("video ko'rilgan, lekin kalit so'zlar bilan tanishilmagan — oddiy o'quvchiga yopiq, ochilganga ochiq", async () => {
    const plain = await newUser();
    const opened = await newUser();
    for (const u of [plain, opened]) {
      await prisma.lessonProgress.create({ data: { userId: u.userId, lessonId: SLUG, maxPosition: 793, watchedSeconds: 793, completedAt: new Date() } });
    }
    await prisma.user.update({ where: { id: opened.userId }, data: { unlockAll: true } });
    expect((await http().get(`/topics/${SLUG}/questions`).set(plain.auth).expect(403)).body.code).toBe("KEYWORDS_NOT_REVIEWED");
    await http().get(`/topics/${SLUG}/questions`).set(opened.auth).expect(200);
  });

  it("admin: foydalanuvchi sahifasida faqat oxirgi 3 ta qurilma (eng yangisi birinchi)", async () => {
    const user = await newUser();
    const base = Date.now();
    for (let i = 1; i <= 5; i++) {
      await prisma.session.create({
        data: { userId: user.userId, tokenHash: `e2e-device-${user.userId}-${i}`, userAgent: `UA-${i}`, lastSeenAt: new Date(base - i * 60_000), expiresAt: new Date(base + 86_400_000) },
      });
    }
    const detail = (await http().get(`/admin/users/${user.userId}`).set(admin).expect(200)).body as { devices: { id: string; lastSeenAt: string }[] };
    expect(detail.devices).toHaveLength(3);
    const seen = detail.devices.map((d) => new Date(d.lastSeenAt).getTime());
    expect([...seen].sort((a, b) => b - a)).toEqual(seen);
  });
});
