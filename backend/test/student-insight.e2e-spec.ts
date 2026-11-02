import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { AiService } from "../src/ai/ai.service";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";

// "Mening tahlilim": statistika bazadan; AI xulosa kabinet tilida, kuniga bir marta va faqat yangi urinishdan keyin.
let app: INestApplication;
let prisma: PrismaService;
let user: { Authorization: string };
let userId: string;
let create: ReturnType<typeof vi.fn>;
const usage = { input_tokens: 400, output_tokens: 90, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

function http() {
  return request(app.getHttpServer());
}

function reply(summary: string) {
  return { model: "claude-haiku-5-5", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ summary, tips: ["Bir", "Ikki", "Uch", "To'rt"] }) }], usage };
}

beforeAll(async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  const session = await app.get(AuthService).createAnonymousSession();
  user = { Authorization: `Bearer ${session.token}` };
  userId = (await prisma.session.findFirstOrThrow({ orderBy: { createdAt: "desc" } })).userId;
  await prisma.user.update({ where: { id: userId }, data: { firstName: "Maxfiy-Ism", phone: "+998990001122" } });
  create = vi.fn();
  (app.get(AiService) as unknown as { client: unknown }).client = { beta: { messages: { create } } };
});

afterAll(async () => {
  await prisma.aiStudentInsight.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.topic.deleteMany({ where: { slug: { in: ["day97-topic1", "day97-topic2"] } } });
  delete process.env.ANTHROPIC_API_KEY;
  (app.get(AiService) as unknown as { client: unknown }).client = null;
  await app.close();
});

describe("Mening tahlilim", () => {
  it("sessiyasiz — 401", async () => {
    await http().get("/me/insight").expect(401);
  });

  it("urinishsiz: statistika bo'sh, AI chaqirilmaydi", async () => {
    const res = (await http().get("/me/insight").set(user).expect(200)).body;
    expect(res).toMatchObject({ insight: null, canRefresh: false, stats: { attempts: 0 } });
    const err = await http().post("/me/insight").set(user).expect(400);
    expect(err.body.code).toBe("NO_ATTEMPTS");
    expect(create).not.toHaveBeenCalled();
  });

  it("urinishdan keyin: xulosa kabinet tilida, shaxsiy ma'lumotsiz; kuniga bir marta", async () => {
    const topics = [];
    for (const slug of ["day97-topic1", "day97-topic2"]) {
      await prisma.topic.deleteMany({ where: { slug } });
      const t = await prisma.topic.create({ data: { slug, title: slug } });
      await prisma.question.create({ data: { topicId: t.id, order: 1, text: "Savol?", keyword: "savol" } });
      topics.push(t);
    }
    await prisma.topicTestAttempt.createMany({
      data: [
        { userId, topicId: topics[0].id, correct: 100, total: 100, percent: 100 },
        { userId, topicId: topics[1].id, correct: 60, total: 100, percent: 60 },
      ],
    });
    const before = (await http().get("/me/insight?locale=uz-cyrl").set(user).expect(200)).body;
    expect(before.stats).toMatchObject({ attempts: 2, topics: { attempted: 2, passed: 1 } });
    expect(before.stats.weakTopics[0]).toMatchObject({ slug: topics[1].slug, bestPercent: 60 });
    expect(before.canRefresh).toBe(true);

    create.mockResolvedValueOnce(reply("Яхши натижа"));
    const made = (await http().post("/me/insight?locale=uz-cyrl").set(user).expect(200)).body;
    expect(made.insight).toMatchObject({ summary: "Яхши натижа", tips: ["Bir", "Ikki", "Uch"], locale: "uz-cyrl" });
    expect(made.canRefresh).toBe(false);
    const sent = create.mock.calls[0][0];
    expect(sent.model).toBe("claude-haiku-5-5");
    expect(JSON.stringify(sent)).toContain("KIRILL");
    expect(JSON.stringify(sent)).not.toMatch(/Maxfiy-Ism|998990001122/);
    expect(await prisma.aiUsage.count({ where: { userId, feature: "student" } })).toBe(1);

    // Yangi urinish bo'lsa ham — 24 soat o'tmaguncha qayta so'ralmaydi.
    await prisma.topicTestAttempt.create({ data: { userId, topicId: topics[1].id, correct: 99, total: 100, percent: 99 } });
    const again = (await http().post("/me/insight?locale=uz-cyrl").set(user).expect(200)).body;
    expect(again.insight.summary).toBe("Яхши натижа");
    expect(again.nextRefreshAt).toBeTruthy();
    expect(create).toHaveBeenCalledTimes(1);

    // 24 soatdan keyin, yangi urinish bor — yangilanadi.
    await prisma.$executeRaw`UPDATE "AiStudentInsight" SET "updatedAt" = now() - interval '25 hours' WHERE "userId" = ${userId}`;
    create.mockResolvedValueOnce(reply("Davom eting"));
    const fresh = (await http().post("/me/insight?locale=uz-latn").set(user).expect(200)).body;
    expect(fresh.insight).toMatchObject({ summary: "Davom eting", locale: "uz-latn" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("noto'g'ri til — 400", async () => {
    await http().get("/me/insight?locale=en").set(user).expect(400);
  });
});
