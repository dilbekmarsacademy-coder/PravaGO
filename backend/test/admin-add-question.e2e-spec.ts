import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { locatePhrases } from "../src/admin/content/question-create.service";
import { AiService } from "../src/ai/ai.service";
import { STUDENT_QUESTION_WHERE } from "../src/common/question-content";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// Kun mavzusiga admin yangi savol qo'shadi: lotin → AI (kirill, rus, kalit so'z) → tasdiqlash → saytda.
const SLUG = "day6-topic98";
const COLLECTION_SLUG = "new-e2e-addq";
const ADMIN = "e2e-addquestion";
const PASSWORD = "Add-Question-2026";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
const create = vi.fn();

function http() {
  return request(app.getHttpServer());
}

const LATN = {
  text: "Qaysi holatda quvib o'tish taqiqlanadi?",
  options: ["Piyodalar o'tish joyida", "Ko'prikda", "Hamma javob to'g'ri"],
  explanation: "",
};

/** AI javobi (mock): kirill, rus va har tildagi kalit iboralar. */
function aiReply(keywords: { question: Record<string, string[]>; answer: Record<string, string[]> }) {
  return {
    model: "e2e-test",
    stop_reason: "end_turn",
    content: [
      {
        type: "text",
        text: JSON.stringify({
          cyrl: { text: "Қайси ҳолатда қувиб ўтиш тақиқланади?", options: ["Пиёдалар ўтиш жойида", "Кўприкда", "Ҳамма жавоб тўғри"], explanation: "" },
          ru: { text: "В каком случае обгон запрещён?", options: ["На пешеходном переходе", "На мосту", "Все ответы верны"], explanation: "" },
          keywords,
        }),
      },
    ],
    usage: { input_tokens: 500, output_tokens: 200 },
  };
}

beforeAll(async () => {
  await configureAdminEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await prisma.topic.deleteMany({ where: { slug: { in: [SLUG, COLLECTION_SLUG] } } });
  const topic = await prisma.topic.create({ data: { slug: SLUG, title: SLUG } });
  await prisma.question.create({
    data: { topicId: topic.id, order: 1, text: "Савол", textLatn: "Savol", keyword: "", options: { create: [{ order: 1, text: "А", isCorrect: true }, { order: 2, text: "Б" }] } },
  });
  await prisma.topic.create({ data: { slug: COLLECTION_SLUG, title: COLLECTION_SLUG, kind: "collection" } });
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.31.0.1");
});

afterAll(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  await prisma.topic.deleteMany({ where: { slug: { in: [SLUG, COLLECTION_SLUG] } } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  await app.close();
});

describe("locatePhrases", () => {
  it("katta-kichik harf va apostrof farqsiz; kesishmaydi; topilmaganlar qaytadi", () => {
    expect(locatePhrases("Qaysi holatda quvib o‘tish taqiqlanadi?", ["QUVIB O'TISH", "yo'q"])).toEqual({ ranges: [[14, 26]], missing: ["yo'q"] });
    expect(locatePhrases("bir bir", ["bir", "bir"]).ranges).toEqual([[0, 3], [4, 7]]);
  });
});

describe("Kun mavzusiga yangi savol", () => {
  const prepareBody = (keywords: Record<string, unknown>) => ({ ...LATN, correctIndex: 0, keywords });

  it("AI sozlanmagan — 503; kirill matn, to'plam yoki yo'q mavzu — rad etiladi", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await http().post(`/admin/content/topics/${SLUG}/questions/prepare`).set(admin).send(prepareBody({ mode: "ai" })).expect(503);
    expect(res.body.code).toBe("AI_NOT_CONFIGURED");

    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    (app.get(AiService) as unknown as { client: unknown }).client = { beta: { messages: { create } } };
    await http().post(`/admin/content/topics/${SLUG}/questions/prepare`).set(admin).send({ ...prepareBody({ mode: "ai" }), text: "Қайси ҳолатда?" }).expect(400);
    await http().post(`/admin/content/topics/${SLUG}/questions/prepare`).set(admin).send({ ...prepareBody({ mode: "ai" }), correctIndex: 5 }).expect(400);
    await http().post(`/admin/content/topics/${COLLECTION_SLUG}/questions/prepare`).set(admin).send(prepareBody({ mode: "ai" })).expect(404);
    await http().post(`/admin/content/topics/day6-topic97/questions/prepare`).set(admin).send(prepareBody({ mode: "ai" })).expect(404);
    await http().post(`/admin/content/topics/${SLUG}/questions/prepare`).send(prepareBody({ mode: "ai" })).expect(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("AI kalit so'z tanlaydi: uch tilda matn va belgilashlar; hech narsa saqlanmaydi", async () => {
    create.mockResolvedValueOnce(
      aiReply({
        question: { uz: ["quvib o'tish"], cyrl: ["қувиб ўтиш"], ru: ["обгон"] },
        answer: { uz: ["Piyodalar o'tish joyida"], cyrl: ["Пиёдалар ўтиш жойида"], ru: ["пешеходном переходе", "yo'q ibora"] },
      }),
    );
    const before = await prisma.question.count({ where: { topic: { slug: SLUG } } });
    const res = await http().post(`/admin/content/topics/${SLUG}/questions/prepare`).set(admin).send(prepareBody({ mode: "ai" })).expect(200);
    expect(res.body.text).toEqual({ latn: LATN.text, cyrl: "Қайси ҳолатда қувиб ўтиш тақиқланади?", ru: "В каком случае обгон запрещён?" });
    expect(res.body.options[0].text).toEqual({ latn: "Piyodalar o'tish joyida", cyrl: "Пиёдалар ўтиш жойида", ru: "На пешеходном переходе" });
    expect(res.body.keywords).toEqual({
      none: false,
      question: { uz: [[14, 26]], cyrl: [[14, 24]], ru: [[15, 20]] },
      answer: { uz: [[0, 23]], cyrl: [[0, 20]], ru: [[3, 22]] },
    });
    expect(res.body.warnings).toHaveLength(1);
    expect(await prisma.question.count({ where: { topic: { slug: SLUG } } })).toBe(before);
    // AI'ga faqat savol matni ketadi; kalit so'zni AI tanlaydi (keywords: null).
    const sent = JSON.parse((create.mock.lastCall![0] as { messages: { content: { text: string }[] }[] }).messages[0].content[0].text);
    expect(sent).toMatchObject({ text: LATN.text, correctIndex: 0, keywords: null });
  });

  it("admin o'zi belgilagan lotin kalit so'z o'zgarmaydi, AI faqat kirill/rus mosini beradi", async () => {
    // Yarim belgilash (faqat savol kaliti) — AI'ga yuborilmaydi, 400.
    await http().post(`/admin/content/topics/${SLUG}/questions/prepare`).set(admin).send(prepareBody({ mode: "manual", question: [[27, 38]] })).expect(400);
    await http().post(`/admin/content/topics/${SLUG}/questions/prepare`).set(admin).send(prepareBody({ mode: "manual", question: [[30, 99]], answer: [[0, 8]] })).expect(400);
    await http().post(`/admin/content/topics/${SLUG}/questions/prepare`).set(admin).send(prepareBody({ mode: "none" })).expect(400);
    create.mockResolvedValueOnce(aiReply({ question: { uz: ["taqiqlanadi"], cyrl: ["тақиқланади"], ru: ["запрещён"] }, answer: { uz: ["Piyodalar"], cyrl: ["Пиёдалар"], ru: ["пешеходном"] } }));
    const res = await http()
      .post(`/admin/content/topics/${SLUG}/questions/prepare`)
      .set(admin)
      .send(prepareBody({ mode: "manual", question: [[27, 38]], answer: [[0, 9]] }))
      .expect(200);
    expect(res.body.keywords.question).toEqual({ uz: [[27, 38]], cyrl: [[25, 36]], ru: [[21, 29]] });
    expect(res.body.keywords.answer).toEqual({ uz: [[0, 9]], cyrl: [[0, 8]], ru: [[3, 13]] });
    const sent = JSON.parse((create.mock.lastCall![0] as { messages: { content: { text: string }[] }[] }).messages[0].content[0].text);
    expect(sent.keywords).toEqual({ question: ["taqiqlanadi"], answer: ["Piyodalar"] });
  });

  it("AI javob kalitini topa olmasa — saqlashga o'tkazilmaydi (KEYWORDS_NOT_FOUND)", async () => {
    create.mockResolvedValueOnce(aiReply({ question: { uz: ["quvib o'tish"], cyrl: ["қувиб ўтиш"], ru: ["обгон"] }, answer: { uz: [], cyrl: [], ru: [] } }));
    const res = await http().post(`/admin/content/topics/${SLUG}/questions/prepare`).set(admin).send(prepareBody({ mode: "ai" })).expect(400);
    expect(res.body.code).toBe("KEYWORDS_NOT_FOUND");
  });

  it("tasdiqlangan savol mavzu oxiriga qo'shiladi va o'quvchilar testida ko'rinadi", async () => {
    create.mockResolvedValueOnce(aiReply({ question: { uz: ["quvib o'tish"], cyrl: ["қувиб ўтиш"], ru: ["обгон"] }, answer: { uz: ["Ko'prikda"], cyrl: ["Кўприкда"], ru: ["мосту"] } }));
    const prepared = (await http().post(`/admin/content/topics/${SLUG}/questions/prepare`).set(admin).send({ ...prepareBody({ mode: "ai" }), correctIndex: 1 }).expect(200)).body;
    const { warnings, ...body } = prepared;
    expect(warnings).toEqual([]);
    const visibleBefore = await prisma.question.count({ where: { topic: { slug: SLUG }, ...STUDENT_QUESTION_WHERE } });

    const created = (await http().post(`/admin/content/topics/${SLUG}/questions`).set(admin).send(body).expect(201)).body;
    expect(created.order).toBe(2);
    expect(created.correctIndex).toBe(1);
    expect(created.options.map((o: { isCorrect: boolean }) => o.isCorrect)).toEqual([false, true, false]);
    expect(created.text.ru).toBe("В каком случае обгон запрещён?");
    expect(created.ruNeedsReview).toBe(false);
    expect(created.answerPending).toBe(false);
    expect(created.keywords).toMatchObject({ none: false, needsReview: false, source: "admin", answer: { uz: [[0, 9]], cyrl: [[0, 8]], ru: [[3, 8]] } });
    expect(await prisma.question.count({ where: { topic: { slug: SLUG }, ...STUDENT_QUESTION_WHERE } })).toBe(visibleBefore + 1);
    const kw = await prisma.questionKeyword.findUnique({ where: { questionId: created.id } });
    expect(kw).toMatchObject({ answerText: "KO'PRIKDA", answerTextCyrl: "КЎПРИКДА", answerTextRu: "МОСТУ" });
    expect(await prisma.auditLog.count({ where: { action: "question.created", entityId: created.id } })).toBe(1);

    // Admin ro'yxatida ham ko'rinadi.
    const list = (await http().get(`/admin/content/topics/${SLUG}/questions`).set(admin).expect(200)).body;
    expect(list.items.map((q: { id: string }) => q.id)).toContain(created.id);

    // To'plamga bu yo'l bilan qo'shib bo'lmaydi; noto'g'ri tana — 400.
    await http().post(`/admin/content/topics/${COLLECTION_SLUG}/questions`).set(admin).send(body).expect(404);
    await http().post(`/admin/content/topics/${SLUG}/questions`).set(admin).send({ ...body, correctIndex: 9 }).expect(400);
    const noKw = await http().post(`/admin/content/topics/${SLUG}/questions`).set(admin).send({ ...body, keywords: { none: true } }).expect(400);
    expect(noKw.body.code).toBe("KEYWORDS_REQUIRED");
  });
});
