import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { AiService } from "../src/ai/ai.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// Admin AI tahlili: tarif bo'yicha sotuv, 98% o'tish, keshlangan xulosa, tool use bilan so'rash, xarajatlar.
const ADMIN = "e2e-aiinsights";
const PASSWORD = "Ai-Insights-Admin-77";
const PHONE_PREFIX = "+99899700";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
let create: ReturnType<typeof vi.fn>;
const usage = { input_tokens: 500, output_tokens: 80, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

function http() {
  return request(app.getHttpServer());
}

beforeAll(async () => {
  await configureAdminEnv();
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await prisma.user.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.61.0.1");
  create = vi.fn();
  (app.get(AiService) as unknown as { client: unknown }).client = { beta: { messages: { create } } };
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
  await prisma.appSetting.deleteMany({ where: { key: { startsWith: "ai.summary." } } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  delete process.env.ANTHROPIC_API_KEY;
  (app.get(AiService) as unknown as { client: unknown }).client = null;
  await app.close();
});

describe("Admin AI tahlili", () => {
  it("statistika: tarif bo'yicha sotuv va 98% o'tish", async () => {
    const before = (await http().get("/admin/stats/dashboard?range=7d").set(admin).expect(200)).body;
    const topic = await prisma.topic.findFirstOrThrow({ where: { kind: "course" } });
    const mk = async (i: number, examStatus: string, amount: number, percent: number) => {
      const u = await prisma.user.create({ data: { phone: `${PHONE_PREFIX}${i}`, examStatus, registeredAt: new Date(), paymentStatus: "PAID" } });
      await prisma.payment.create({ data: { userId: u.id, amount, status: "CONFIRMED", confirmedAt: new Date() } });
      await prisma.topicTestAttempt.create({ data: { userId: u.id, topicId: topic.id, correct: percent, total: 100, percent } });
    };
    await mk(1, "first-time", 350_000, 100);
    await mk(2, "first-time", 350_000, 90);
    await mk(3, "license-revoked", 450_000, 98);
    const after = (await http().get("/admin/stats/dashboard?range=7d").set(admin).expect(200)).body;
    const t = (b: typeof after, k: string) => b.sales.byTariff.find((x: { tariff: string }) => x.tariff === k);
    expect(t(after, "first-time").count - t(before, "first-time").count).toBe(2);
    expect(t(after, "first-time").revenue - t(before, "first-time").revenue).toBe(700_000);
    expect(t(after, "license-revoked").revenue - t(before, "license-revoked").revenue).toBe(450_000);
    expect(after.sales.revenue - before.sales.revenue).toBe(1_150_000);
    expect(after.passRate.threshold).toBe(98);
    expect(after.passRate.attempts - before.passRate.attempts).toBe(3);
    expect(after.passRate.passed - before.passRate.passed).toBe(2);
    // Shaxsiy ma'lumot (telefon) statistikada yo'q.
    expect(JSON.stringify(after)).not.toContain(PHONE_PREFIX);
  });

  it("AI xulosa: keshlanadi, faqat 'Yangilash'da qayta so'raladi", async () => {
    await prisma.appSetting.deleteMany({ where: { key: "ai.summary.7d" } });
    expect((await http().get("/admin/ai/summary?range=7d").set(admin).expect(200)).body).toEqual({ text: null });
    create.mockResolvedValueOnce({ model: "claude-haiku-5-5", stop_reason: "end_turn", content: [{ type: "text", text: "- Sotuv o'sdi" }], usage });
    const made = (await http().post("/admin/ai/summary?range=7d").set(admin).expect(200)).body;
    expect(made).toMatchObject({ text: "- Sotuv o'sdi", range: "7d", model: "claude-haiku-5-5" });
    const sent = create.mock.calls.at(-1)![0];
    expect(sent.model).toBe("claude-haiku-5-5");
    expect(JSON.stringify(sent)).not.toContain(PHONE_PREFIX);
    const calls = create.mock.calls.length;
    const cached = (await http().get("/admin/ai/summary?range=7d").set(admin).expect(200)).body;
    expect(cached.text).toBe("- Sotuv o'sdi");
    expect(create.mock.calls.length).toBe(calls);
  });

  it("Statistikadan so'rash: AI metrika funksiyasini chaqiradi, javob va manbalar qaytadi", async () => {
    create
      .mockResolvedValueOnce({ model: "claude-haiku-5-5", stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu_1", name: "getSales", input: { range: "7d" } }], usage })
      .mockImplementationOnce(async (body: { messages: { role: string; content: { type: string; content?: string }[] }[] }) => {
        const result = body.messages.at(-1)!.content[0];
        expect(result.type).toBe("tool_result");
        const data = JSON.parse(result.content!);
        expect(data.sales.byTariff).toHaveLength(3);
        return { model: "claude-haiku-5-5", stop_reason: "end_turn", content: [{ type: "text", text: `7 kunda ${data.sales.count} ta sotuv.` }], usage };
      });
    const res = (await http().post("/admin/ai/ask-stats").set(admin).send({ question: "Bu hafta nechta sotuv bo'ldi?" }).expect(200)).body;
    expect(res.answer).toMatch(/ta sotuv/);
    expect(res.sources).toEqual([{ name: "getSales", input: { range: "7d" } }]);
    const first = create.mock.calls.at(-2)![0];
    expect(first.tools.map((t: { name: string }) => t.name)).toEqual(["getSales", "getActiveUsers", "getTopWrongQuestions", "getTopicStats", "getFunnel"]);
    expect(first.tools.every((t: { strict: boolean; input_schema: { additionalProperties: boolean } }) => t.strict && t.input_schema.additionalProperties === false)).toBe(true);
  });

  it("AI xarajatlari: shu oy, funksiyalar bo'yicha, budjet", async () => {
    const res = (await http().get("/admin/ai/costs").set(admin).expect(200)).body;
    expect(res.month.byFeature.map((f: { feature: string }) => f.feature)).toEqual(expect.arrayContaining(["report", "ask"]));
    expect(res.month.total).toBeGreaterThan(0);
    expect(res.budget).toMatchObject({ budgetUsd: 5 });
    expect(res.allTime.total).toBeGreaterThanOrEqual(res.month.total);
  });

  it("ruxsatsiz — 401/403", async () => {
    await http().get("/admin/ai/costs").expect((r) => expect([401, 403]).toContain(r.status));
  });
});
