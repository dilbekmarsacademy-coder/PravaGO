import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import Anthropic from "@anthropic-ai/sdk";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppModule } from "../src/app.module";
import { AiService } from "../src/ai/ai.service";
import { budgetLevel, monthStart } from "../src/ai/ai-budget";
import { costUsd, modelFor } from "../src/ai/ai-models";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// "Yangi testlar" to'plamlari, faqat tasdiqlangan izohlar va AiService (budjet, retry, ai_usage) — AI mock.
const ADMIN = "e2e-groupsai";
const PASSWORD = "Groups-Ai-Admin-55";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
let user: { Authorization: string };

function http() {
  return request(app.getHttpServer());
}

async function makeTest(groupId: string, title: string, publish = true): Promise<{ id: string; slug: string }> {
  const col = await http().post("/admin/collections").set(admin).send({ title: { uz: title }, groupId }).expect(201);
  await prisma.question.create({
    data: { topicId: col.body.id, order: 1, text: "Савол", keyword: "", options: { create: [{ order: 1, text: "А", isCorrect: true }, { order: 2, text: "Б" }] } },
  });
  if (publish) await http().patch(`/admin/collections/${col.body.id}`).set(admin).send({ published: true }).expect(200);
  return { id: col.body.id, slug: col.body.slug };
}

beforeAll(async () => {
  await configureAdminEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.50.0.1");
  const { token } = await app.get(AuthService).createAnonymousSession();
  user = { Authorization: `Bearer ${token}` };
});

afterAll(async () => {
  await prisma.topic.deleteMany({ where: { kind: "collection", title: { startsWith: "E2E-G" } } });
  await prisma.testGroup.deleteMany({ where: { name: { startsWith: "E2E-G" } } });
  await prisma.topic.deleteMany({ where: { slug: "e2e-explanation-topic" } });
  await prisma.aiUsage.deleteMany({ where: { feature: "report", model: "e2e-test" } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  delete process.env.ANTHROPIC_API_KEY;
  await app.close();
});

describe("Yangi testlar: to'plamlar", () => {
  it("yaratish, nom, tartib, test qo'shish, ko'chirish, saytda to'plam → testlar", async () => {
    const a = (await http().post("/admin/test-groups").set(admin).send({ name: "E2E-G Yo'l belgilari" }).expect(201)).body;
    const b = (await http().post("/admin/test-groups").set(admin).send({ name: "E2E-G Noyabr" }).expect(201)).body;
    await http().post("/admin/test-groups").set(admin).send({ name: "   " }).expect(400);
    await http().patch(`/admin/test-groups/${b.id}`).set(admin).send({ name: "E2E-G Noyabr yangi savollari" }).expect(200);

    const t1 = await makeTest(a.id, "E2E-G test 1");
    const t2 = await makeTest(a.id, "E2E-G test 2");
    await makeTest(b.id, "E2E-G qoralama", false);

    const ids = (await http().get("/admin/test-groups").set(admin).expect(200)).body.map((g: { id: string }) => g.id);
    const reordered = [b.id, a.id, ...ids.filter((id: string) => id !== a.id && id !== b.id)];
    const after = (await http().post("/admin/test-groups/reorder").set(admin).send({ ids: reordered }).expect(200)).body;
    expect(after.slice(0, 2).map((g: { name: string; testCount: number }) => [g.name, g.testCount])).toEqual([
      ["E2E-G Noyabr yangi savollari", 1],
      ["E2E-G Yo'l belgilari", 2],
    ]);

    // Ko'chirish: test 2 → b
    await http().patch(`/admin/collections/${t2.id}`).set(admin).send({ groupId: b.id }).expect(200);
    const site = (await http().get("/collections/groups").set(user).expect(200)).body as { id: string; name: string; testCount: number; tests: { slug: string }[] }[];
    const ga = site.find((g) => g.id === a.id)!;
    const gb = site.find((g) => g.id === b.id)!;
    expect(ga.tests.map((t) => t.slug)).toEqual([t1.slug]);
    // Qoralama (nashr qilinmagan) saytda ko'rinmaydi.
    expect(gb.tests.map((t) => t.slug)).toEqual([t2.slug]);
    expect(gb.testCount).toBe(1);
  });

  it("ichida test bo'lgan to'plam rozilik bilan o'chiriladi (testlari ham)", async () => {
    const g = (await http().post("/admin/test-groups").set(admin).send({ name: "E2E-G o'chiriladigan" }).expect(201)).body;
    const t = await makeTest(g.id, "E2E-G o'chadigan test");
    const res = await http().post(`/admin/test-groups/${g.id}/delete`).set(admin).send({}).expect(400);
    expect(res.body).toMatchObject({ code: "GROUP_NOT_EMPTY", testCount: 1 });
    await http().post(`/admin/test-groups/${g.id}/delete`).set(admin).send({ withTests: true }).expect(204);
    expect((await prisma.topic.findUniqueOrThrow({ where: { id: t.id } })).deletedAt).not.toBeNull();
    const site = (await http().get("/collections/groups").set(user).expect(200)).body as { id: string }[];
    expect(site.some((x) => x.id === g.id)).toBe(false);
  });

  it("to'plamsiz test yaratib bo'lmaydi", async () => {
    await http().post("/admin/collections").set(admin).send({ title: { uz: "E2E-G to'plamsiz" } }).expect(400);
  });
});

describe("izoh faqat tasdiqlangan bo'lsa ko'rinadi", () => {
  it("check-answer: tasdiqlanmagan — null, tasdiqlangan — izoh", async () => {
    await prisma.topic.deleteMany({ where: { slug: "e2e-explanation-topic" } });
    const topic = await prisma.topic.create({ data: { slug: "e2e-explanation-topic", title: "x" } });
    const q = await prisma.question.create({
      data: {
        topicId: topic.id,
        order: 1,
        text: "Савол",
        keyword: "",
        explanation: "AI изоҳи",
        explanationLatn: "AI izohi",
        explanationApproved: false,
        options: { create: [{ order: 1, text: "А", isCorrect: true }, { order: 2, text: "Б" }] },
      },
      include: { options: true },
    });
    const correct = q.options.find((o) => o.isCorrect)!.id;
    let res = await http().post(`/questions/${q.id}/check-answer`).set(user).send({ optionId: correct }).expect(200);
    expect(res.body.explanation).toBeNull();
    await prisma.question.update({ where: { id: q.id }, data: { explanationApproved: true } });
    res = await http().post(`/questions/${q.id}/check-answer`).set(user).send({ optionId: correct }).expect(200);
    expect(res.body.explanation).toMatchObject({ uz: "AI izohi" });
  });
});

describe("AiService", () => {
  it("model va narx: funksiya bo'yicha, env bilan almashtiriladi", () => {
    expect(modelFor("import.analyze")).toBe("claude-sonnet-5-5");
    expect(modelFor("import.classify")).toBe("claude-haiku-5-5");
    expect(modelFor("translate")).toBe("claude-sonnet-5-5");
    expect(modelFor("report")).toBe("claude-haiku-5-5");
    process.env.AI_MODEL_REPORT = "claude-sonnet-5-5";
    expect(modelFor("report")).toBe("claude-sonnet-5-5");
    delete process.env.AI_MODEL_REPORT;
    expect(costUsd("claude-sonnet-5-5", { inputTokens: 1_000_000, outputTokens: 100_000 })).toBeCloseTo(3, 5);
    expect(costUsd("claude-haiku-5-5", { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 1_000_000 })).toBeCloseTo(0.11, 5);
    expect(budgetLevel(3.9, 5)).toBe("ok");
    expect(budgetLevel(4, 5)).toBe("warn");
    expect(budgetLevel(5, 5)).toBe("blocked");
  });

  it("retry (529) → muvaffaqiyat; har bir urinish ai_usage'ga; zod tekshiruvi; budjet tugasa to'xtaydi", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    const ai = app.get(AiService);
    const create = vi.fn();
    (ai as unknown as { client: unknown }).client = { beta: { messages: { create } } };
    const overloaded = Anthropic.APIError.generate(529, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }, "Overloaded", new Headers());
    create.mockRejectedValueOnce(overloaded).mockResolvedValueOnce({
      model: "e2e-test",
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify({ ok: true, n: 3 }) }],
      usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    });
    const before = await prisma.aiUsage.count({ where: { feature: "report" } });
    const out = await ai.json({ feature: "report", system: "s", content: [{ type: "text", text: "x" }], schema: {}, validate: z.object({ ok: z.boolean(), n: z.number() }) });
    expect(out).toEqual({ ok: true, n: 3 });
    expect(create).toHaveBeenCalledTimes(2);
    expect(await prisma.aiUsage.count({ where: { feature: "report" } })).toBe(before + 2);

    // Noto'g'ri ko'rinishdagi javob — aniq xato.
    create.mockResolvedValueOnce({ model: "e2e-test", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ ok: "yo'q" }) }], usage: { input_tokens: 1, output_tokens: 1 } });
    await expect(ai.json({ feature: "report", system: "s", content: [{ type: "text", text: "x" }], schema: {}, validate: z.object({ ok: z.boolean() }) })).rejects.toMatchObject({ response: { code: "AI_BAD_RESPONSE" } });

    // Billing xatosi — tushunarli xabar, qayta urinilmaydi.
    create.mockRejectedValueOnce(Anthropic.APIError.generate(400, { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low" } }, "Your credit balance is too low", new Headers()));
    await expect(ai.text({ feature: "report", system: "s", messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ response: { code: "AI_BILLING" } });

    // Budjet: shu oy sarfi budjetdan oshsa — chaqiruv umuman yuborilmaydi.
    process.env.AI_MONTHLY_BUDGET_USD = "0.5";
    const row = await prisma.aiUsage.create({ data: { feature: "report", model: "e2e-test", costUsd: 1, createdAt: new Date(Math.max(Date.now() - 1000, monthStart().getTime())) } });
    const calls = create.mock.calls.length;
    await expect(ai.text({ feature: "report", system: "s", messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ response: { code: "AI_BUDGET_EXCEEDED" } });
    expect(create.mock.calls.length).toBe(calls);
    expect((await ai.budget()).level).toBe("blocked");
    await prisma.aiUsage.delete({ where: { id: row.id } });
    delete process.env.AI_MONTHLY_BUDGET_USD;
    (ai as unknown as { client: unknown }).client = null;
  });
});
