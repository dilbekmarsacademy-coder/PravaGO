import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { AiService } from "../src/ai/ai.service";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";
import { makeFixtureSet } from "./helpers/import-fixtures";

// To'liq import oqimi (AI mock): bir nechta fayl → progress → testlar → tekshiruv → tasdiqlash → "Yangi testlar".
const ADMIN = "e2e-aiimport";
const PASSWORD = "Ai-Import-Admin-55";
const GROUP = "E2E-AI import to'plami";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
let user: { Authorization: string };
let create: ReturnType<typeof vi.fn>;

function http() {
  return request(app.getHttpServer());
}

/** AI javoblari — so'rov turiga qarab (system prompt bo'yicha). */
function mockReply(body: { system: { text: string }[]; messages: { content: { type: string; text?: string }[] }[] }) {
  const system = body.system[0].text;
  const blocks = body.messages[0].content;
  const lastText = [...blocks].reverse().find((b) => b.type === "text")?.text ?? "";
  let out: unknown;
  if (system.includes("You classify files")) {
    const name = /File: (.*)/.exec(lastText)?.[1] ?? "";
    out = { kind: name.includes("kalit") ? "keys_only" : "questions_full", topics: [], questionCount: 0, script: "mixed", language: "uz", reason: null };
  } else if (system.includes("checking driving-licence exam questions")) {
    const items = JSON.parse(lastText) as { id: string; options: string[]; fileAnswer: number | null; fileKeys: unknown; text: string }[];
    out = {
      results: items.map((i) => ({
        id: i.id,
        correctIndex: i.fileAnswer ?? 0,
        doubt: null,
        guessReason: i.fileAnswer === null ? "Qoidaga ko'ra birinchi variant" : null,
        questionKey: i.fileKeys ? null : i.text.split(" ").slice(0, 2).join(" "),
        answerKey: i.fileKeys ? null : i.options[i.fileAnswer ?? 0].split(" ")[0],
        explanation: "Qoidaga muvofiq shu javob to'g'ri.",
        ru: { text: "Вопрос", options: i.options.map((_, k) => `Вариант ${k + 1}`), explanation: "Пояснение." },
        confidence: i.fileAnswer === null ? "low" : "high",
        problems: [],
      })),
    };
  } else if (system.includes("compare pairs")) {
    out = { pairs: (JSON.parse(lastText) as { id: string }[]).map((p) => ({ id: p.id, same: true })) };
  } else if (system.includes("Find ONLY overlays")) {
    const size = /Image size: (\d+)×(\d+)/.exec(lastText);
    const w = Number(size?.[1] ?? 480);
    const h = Number(size?.[2] ?? 320);
    out = { boxes: [{ x: w - 160, y: Math.round(h * 0.9), w: 156, h: Math.round(h * 0.08), background: "smooth", label: "avtotest.uz" }] };
  } else if (system.includes("AFTER watermark removal")) {
    out = { residue: false, smudge: false, note: null };
  } else throw new Error(`kutilmagan AI so'rovi: ${system.slice(0, 60)}`);
  return { model: body["model" as never] ?? "claude-sonnet-5-5", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(out) }], usage: { input_tokens: 900, output_tokens: 150, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
}

async function stepUntil(batchId: string, done: (status: string) => boolean, max = 80): Promise<{ status: string; stats: Record<string, unknown> }> {
  let last = { status: "", stats: {} as Record<string, unknown> };
  for (let i = 0; i < max; i++) {
    const res = await http().post(`/admin/ai-imports/${batchId}/step`).set(admin).expect(200);
    last = res.body;
    if (done(res.body.status)) return last;
  }
  throw new Error(`Qadamlar tugamadi: ${JSON.stringify(last)}`);
}

beforeAll(async () => {
  await configureAdminEnv();
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  process.env.STORAGE_LOCAL_DIR = `${process.cwd()}/test/output/storage`;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.60.0.1");
  const { token } = await app.get(AuthService).createAnonymousSession();
  user = { Authorization: `Bearer ${token}` };
  create = vi.fn(async (body) => mockReply(body));
  (app.get(AiService) as unknown as { client: unknown }).client = { beta: { messages: { create } } };
});

afterAll(async () => {
  await prisma.importBatch.deleteMany({ where: { group: { name: GROUP } } });
  await prisma.topic.deleteMany({ where: { group: { name: GROUP } } });
  await prisma.testGroup.deleteMany({ where: { name: GROUP } });
  await prisma.aiUsage.deleteMany({ where: { model: { in: ["claude-sonnet-5-5", "claude-haiku-5-5"] }, batchId: { not: null } } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  delete process.env.ANTHROPIC_API_KEY;
  (app.get(AiService) as unknown as { client: unknown }).client = null;
  await app.close();
});

describe("AI bilan fayllardan import", () => {
  let batchId: string;

  it("qabul qilinmaydigan fayl va to'plamsiz import rad etiladi", async () => {
    await http().post("/admin/ai-imports").set(admin).send({ newGroupName: GROUP, removeWatermarks: true, files: [{ name: "a.exe", size: 10 }] }).expect(400);
    await http().post("/admin/ai-imports").set(admin).send({ removeWatermarks: true, files: [{ name: "a.docx", size: 10 }] }).expect(400);
    await http().post("/admin/ai-imports").set(user).send({ newGroupName: GROUP, removeWatermarks: true, files: [{ name: "a.docx", size: 10 }] }).expect(403);
  });

  it("bir nechta fayl → ochish → taxminiy narx → boshlash → tahlil → tekshiruv", async () => {
    const { files } = await makeFixtureSet();
    const all = [...files, { name: "3-kun-savollar-nusxa.docx", data: files[1].data }];
    const created = await http()
      .post("/admin/ai-imports")
      .set(admin)
      .send({ newGroupName: GROUP, removeWatermarks: true, files: all.map((f) => ({ name: f.name, size: f.data.length })) })
      .expect(201);
    batchId = created.body.batchId;
    expect(created.body.uploads).toHaveLength(5);
    expect(created.body.uploads[0].target.method).toBe("POST");
    for (const [i, u] of (created.body.uploads as { fileId: string }[]).entries()) {
      await http().post(`/admin/ai-imports/${batchId}/files/${u.fileId}/upload`).set(admin).attach("file", all[i].data, all[i].name).expect(204);
    }
    const ready = await stepUntil(batchId, (s) => s === "ready");
    const estimate = ready.stats.estimate as { usd: number; questions: number; images: number };
    expect(estimate.questions).toBe(10);
    expect(estimate.images).toBe(4); // dublikat fayldagi rasmlar hash bo'yicha qayta saqlanmaydi
    expect(estimate.usd).toBeGreaterThan(0);

    await http().post(`/admin/ai-imports/${batchId}/start`).set(admin).expect(200);
    const done = await stepUntil(batchId, (s) => s === "review" || s === "partial_error");
    expect(done.status).toBe("review");
    const q = done.stats.questions as { total: number; duplicates: number; analyzed: number };
    expect(q.duplicates).toBe(2);
    expect(q.total).toBe(8);
    expect(q.analyzed).toBe(8);
    expect(await prisma.aiUsage.count({ where: { batchId } })).toBeGreaterThan(5);
  });

  it("testlar kun/mavzu bo'yicha; kalitlar boshqa fayldan; rasmlar tozalangan", async () => {
    const detail = (await http().get(`/admin/ai-imports/${batchId}`).set(admin).expect(200)).body;
    const titles = detail.tests.map((t: { title: string }) => t.title);
    expect(titles).toEqual(["2-kun 1-mavzu: Ogohlantiruvchi belgilar", "3-kun 2-mavzu: Yuk tashish", "5-kun 3-mavzu: Quvib o'tish", "5-kun 4-mavzu: Temir yo'l kesishmalari"]);
    const yuk = detail.tests[1];
    const qs = (await http().get(`/admin/ai-imports/${batchId}/tests/${yuk.id}/questions`).set(admin).expect(200)).body.items;
    expect(qs).toHaveLength(2);
    expect(qs[0].data).toMatchObject({ correctIndex: 1, correctSource: "file", keywords: { question: "ЙЎЛОВЧИЛАР СОНИ", answer: "ЎРИНДИҚЛАР СОНИ", source: "file" } });
    expect(qs[0].matchStatus).toBe("matched");
    expect(qs[0].data.sources.map((s: { part: string }) => s.part)).toEqual(["question", "answer", "keywords"]);
    expect(qs[0].image).toMatchObject({ status: "done", selected: "cleaned", hasCleaned: true });
    // Pastki chiziqdagi watermark (bottom) — crop varianti ham tayyorlangan.
    expect(qs[1].image.hasCrop).toBe(true);
    const img = await http().get(`/admin/ai-imports/images/${qs[0].image.id}/cleaned`).set(admin).expect(200);
    expect(img.headers["content-type"]).toBe("image/png");
  });

  it("tasdiqlash qoidasi: hamma savol tasdiqlanmaguncha test chiqmaydi; tasdiqlangach — Yangi testlarda", async () => {
    const detail = (await http().get(`/admin/ai-imports/${batchId}`).set(admin).expect(200)).body;
    const first = detail.tests[0];
    const before = (await http().get(`/admin/ai-imports/${batchId}/tests/${first.id}/questions?filter=review`).set(admin).expect(200)).body.items;
    // 3-savol (hammasi qalin) — javob AI'dan → "tekshirish kerak".
    expect(before.map((q: { data: { correctSource: string } }) => q.data.correctSource)).toEqual(["ai"]);

    const bulk = (await http().post(`/admin/ai-imports/${batchId}/tests/${first.id}/approve-file-answers`).set(admin).expect(200)).body;
    expect(bulk).toEqual({ approved: 2, remaining: 1 });
    const fail = await http().post(`/admin/ai-imports/${batchId}/tests/${first.id}/publish`).set(admin).expect(400);
    expect(fail.body.code).toBe("NOT_ALL_APPROVED");
    // Tasdiqlanmagan test saytda yo'q.
    const site0 = (await http().get("/collections/groups").set(user).expect(200)).body as { name: string }[];
    expect(site0.some((g) => g.name === GROUP)).toBe(false);

    const aiQ = before[0];
    await http().patch(`/admin/ai-imports/questions/${aiQ.id}`).set(admin).send({ correctIndex: 2, keywords: { question: "қалин", answer: "Учинчи" } }).expect(200);
    await http().post(`/admin/ai-imports/questions/${aiQ.id}/approve`).set(admin).send({ approved: true }).expect(204);
    await http().patch(`/admin/ai-imports/${batchId}/tests/${first.id}`).set(admin).send({ title: "2-kun 1-mavzu: Ogohlantiruvchi belgilar (yangi)" }).expect(200);
    const pub = (await http().post(`/admin/ai-imports/${batchId}/tests/${first.id}/publish`).set(admin).expect(200)).body;

    const topic = await prisma.topic.findUniqueOrThrow({ where: { id: pub.topicId }, include: { group: true, questions: { orderBy: { order: "asc" }, include: { options: true, keywords: true } } } });
    expect(topic).toMatchObject({ kind: "collection", published: true, title: "2-kun 1-mavzu: Ogohlantiruvchi belgilar (yangi)", linkedDay: 2 });
    expect(topic.group?.name).toBe(GROUP);
    expect(topic.questions).toHaveLength(3);
    const [q1, , q3] = topic.questions;
    expect(q1.text).toBe("Бу белги нимани билдиради?");
    expect(q1.textLatn).toBe("Bu belgi nimani bildiradi?");
    expect(q1.options.find((o) => o.isCorrect)?.text).toBe("Йўл ишлари");
    expect(q1.imageUrl).toMatch(/^\/media\/[0-9a-f-]+\.webp$/);
    expect(q1.imageSmallUrl).toMatch(/^\/media\/[0-9a-f-]+\.webp$/);
    expect(q1.explanationApproved).toBe(true);
    expect(q3.options.find((o) => o.isCorrect)?.text).toBe("Учинчи");
    expect(q3.keywords?.answerTextCyrl).toBe("УЧИНЧИ");

    // Saytda: to'plam → test; savollar oddiy test API orqali (to'g'ri javobsiz).
    const site = (await http().get("/collections/groups").set(user).expect(200)).body as { name: string; tests: { slug: string; questionCount: number }[] }[];
    const g = site.find((x) => x.name === GROUP)!;
    expect(g.tests).toEqual([expect.objectContaining({ slug: pub.slug, questionCount: 3 })]);
    const qList = await http().get(`/topics/${pub.slug}/questions`).set(user).expect(200);
    expect(JSON.stringify(qList.body)).not.toContain("isCorrect");

    // Tasdiqlangan testni qayta tahrirlab bo'lmaydi (endi "Yangi testlar"da).
    await http().patch(`/admin/ai-imports/questions/${aiQ.id}`).set(admin).send({ correctIndex: 0 }).expect(400);
    const audit = await prisma.auditLog.findFirst({ where: { action: "ai_import.test_published", entityId: pub.topicId } });
    expect(audit?.after).toMatchObject({ questions: 3, editedByAdmin: 1, aiAnswers: 1 });
  });

  it("qayta tozalash: admin chizgan to'rtburchak bilan", async () => {
    const img = await prisma.importImage.findFirstOrThrow({ where: { batchId } });
    const res = await http().post(`/admin/ai-imports/images/${img.id}/reclean`).set(admin).send({ boxes: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.1 }] }).expect(201);
    expect(res.body.boxes).toEqual([{ x: 0.1, y: 0.1, w: 0.2, h: 0.1 }]);
    expect(res.body.cleanedKey).toBeTruthy();
  });
});
