import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { AiService } from "../src/ai/ai.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// Kalit so'zi yo'q yoki biror tilda to'liq bo'lmagan savollar: ro'yxat va AI bilan to'ldirish.
const SLUG = "day6-topic96";
const ADMIN = "e2e-kwfill";
const PASSWORD = "Keyword-Fill-2026";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
const create = vi.fn();
const ids: Record<string, string> = {};

const http = () => request(app.getHttpServer());

function reply(keywords: { question: Record<string, string[]>; answer: Record<string, string[]> }) {
  return { model: "e2e-test", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(keywords) }], usage: { input_tokens: 100, output_tokens: 50 } };
}

async function question(key: string, opts: { ru?: boolean; pending?: boolean; keywords?: Record<string, unknown> } = {}) {
  const topic = await prisma.topic.findUniqueOrThrow({ where: { slug: SLUG } });
  const q = await prisma.question.create({
    data: {
      topicId: topic.id,
      order: Object.keys(ids).length + 1,
      text: "Қизил чироқда ҳаракат тақиқланади?",
      textLatn: "Qizil chiroqda harakat taqiqlanadi?",
      textRu: opts.ru === false ? null : "На красный сигнал движение запрещено?",
      keyword: "",
      answerPending: opts.pending ?? false,
      options: {
        create: [
          { order: 1, text: "Ҳа, тақиқланади", textLatn: "Ha, taqiqlanadi", textRu: opts.ru === false ? null : "Да, запрещено", isCorrect: true },
          { order: 2, text: "Йўқ", textLatn: "Yo'q", textRu: "Нет" },
        ],
      },
      ...(opts.keywords ? { keywords: { create: opts.keywords } } : {}),
    },
  });
  ids[key] = q.id;
}

beforeAll(async () => {
  await configureAdminEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await prisma.topic.deleteMany({ where: { slug: SLUG } });
  await prisma.topic.create({ data: { slug: SLUG, title: SLUG } });
  await question("none");
  await question("noneSource", { keywords: { source: "none", highlights: {} } });
  await question("noRu", {
    keywords: {
      questionText: "QIZIL CHIROQDA",
      questionTextCyrl: "ҚИЗИЛ ЧИРОҚДА",
      answerText: "TAQIQLANADI",
      answerTextCyrl: "ТАҚИҚЛАНАДИ",
      source: "html",
      highlights: { question: { uz: [0, 14], cyrl: [0, 13] }, answer: { uz: [4, 15], cyrl: [4, 15] } },
    },
  });
  const full = {
    questionText: "QIZIL CHIROQDA",
    questionTextCyrl: "ҚИЗИЛ ЧИРОҚДА",
    questionTextRu: "КРАСНЫЙ СИГНАЛ",
    answerText: "TAQIQLANADI",
    answerTextCyrl: "ТАҚИҚЛАНАДИ",
    answerTextRu: "ЗАПРЕЩЕНО",
    source: "html",
  };
  await question("full", { keywords: full });
  // Rus matni yo'q savolda ruscha kalit talab qilinmaydi; javobsiz (kutilayotgan) savol o'quvchiga ko'rinmaydi.
  await question("noRuText", { ru: false, keywords: { ...full, questionTextRu: null, answerTextRu: null } });
  await question("pending", { pending: true });
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.32.0.1");
});

afterAll(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  await prisma.topic.deleteMany({ where: { slug: SLUG } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  await app.close();
});

describe("Kalit so'z ogohlantirishi va AI bilan to'ldirish", () => {
  async function missingHere() {
    const res = await http().get("/admin/content/keywords/missing").set(admin).expect(200);
    return (res.body.items as { id: string; missing: string[] }[]).filter((i) => Object.values(ids).includes(i.id));
  }

  it("yetishmaydigan savollar va tillar ro'yxati", async () => {
    const items = await missingHere();
    expect(items.map((i) => i.id).sort()).toEqual([ids.none, ids.noneSource, ids.noRu].sort());
    expect(items.find((i) => i.id === ids.none)!.missing).toHaveLength(6);
    expect(items.find((i) => i.id === ids.noRu)!.missing).toEqual(["savol kaliti (rus)", "javob kaliti (rus)"]);
    await http().get("/admin/content/keywords/missing").expect(403);
  });

  it("AI sozlanmagan — 503", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await http().post("/admin/content/keywords/fill").set(admin).send({ ids: [ids.none] }).expect(503);
    expect(res.body.code).toBe("AI_NOT_CONFIGURED");
  });

  it("to'ldiradi: mavjud kalitlar o'zgarmaydi, yangilari needsReview; topilmagani — failed", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    (app.get(AiService) as unknown as { client: unknown }).client = { beta: { messages: { create } } };
    create
      .mockResolvedValueOnce(reply({ question: { uz: ["Qizil chiroqda"], cyrl: ["Қизил чироқда"], ru: ["красный сигнал"] }, answer: { uz: ["taqiqlanadi"], cyrl: ["тақиқланади"], ru: ["запрещено"] } }))
      .mockResolvedValueOnce(reply({ question: { uz: [], cyrl: [], ru: ["yo'q ibora"] }, answer: { uz: ["taqiqlanadi"], cyrl: ["тақиқланади"], ru: ["запрещено"] } }))
      .mockResolvedValueOnce(reply({ question: { uz: ["QIZIL CHIROQDA"], cyrl: ["ҚИЗИЛ ЧИРОҚДА"], ru: ["красный сигнал"] }, answer: { uz: ["TAQIQLANADI"], cyrl: ["ТАҚИҚЛАНАДИ"], ru: ["запрещено"] } }));
    const res = await http().post("/admin/content/keywords/fill").set(admin).send({ ids: [ids.none, ids.noneSource, ids.noRu, ids.full] }).expect(200);
    expect(res.body.filled).toBe(3);
    expect(res.body.failed).toEqual([{ id: ids.noneSource, reason: expect.stringContaining("savol kaliti") }]);
    // To'liq savol uchun AI chaqirilmaydi.
    expect(create).toHaveBeenCalledTimes(3);
    // Mavjud ibora AI'ga o'zgarishsiz uzatiladi.
    const sent = JSON.parse((create.mock.lastCall![0] as { messages: { content: { text: string }[] }[] }).messages[0].content[0].text);
    expect(sent.existing.question.uz).toEqual(["Qizil chiroqda"]);

    const none = await prisma.questionKeyword.findUniqueOrThrow({ where: { questionId: ids.none } });
    expect(none).toMatchObject({
      questionText: "QIZIL CHIROQDA",
      questionTextCyrl: "ҚИЗИЛ ЧИРОҚДА",
      questionTextRu: "КРАСНЫЙ СИГНАЛ",
      answerTextRu: "ЗАПРЕЩЕНО",
      source: "ai",
      needsReview: true,
      highlights: { question: { uz: [0, 14], cyrl: [0, 13], ru: [3, 17] }, answer: { uz: [4, 15], cyrl: [4, 15], ru: [4, 13] } },
    });
    expect((await prisma.question.findUniqueOrThrow({ where: { id: ids.none } })).keyword).toBe("TAQIQLANADI");

    const noRu = await prisma.questionKeyword.findUniqueOrThrow({ where: { questionId: ids.noRu } });
    expect(noRu).toMatchObject({ questionText: "QIZIL CHIROQDA", questionTextRu: "КРАСНЫЙ СИГНАЛ", answerTextRu: "ЗАПРЕЩЕНО", source: "html", needsReview: true });
    expect(noRu.highlights).toMatchObject({ question: { uz: [0, 14], cyrl: [0, 13], ru: [3, 17] }, answer: { uz: [4, 15], ru: [4, 13] } });

    // Qisman to'ldirilgan savol (faqat savol kaliti topilmadi) ro'yxatda qoladi.
    const left = await missingHere();
    expect(left.map((i) => i.id)).toEqual([ids.noneSource]);
    expect(left[0].missing).toEqual(["savol kaliti (lotin)", "savol kaliti (kirill)", "savol kaliti (rus)"]);
    expect(await prisma.auditLog.count({ where: { action: "question.keywords_filled", entityId: { in: [ids.none, ids.noRu, ids.noneSource] } } })).toBe(3);

    await http().post("/admin/content/keywords/fill").set(admin).send({ ids: [] }).expect(400);
  });
});
