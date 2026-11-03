import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { AiService } from "../src/ai/ai.service";
import { screensToQuestions } from "../src/ai-import/import.service";
import { numberedAnswers } from "../src/ai-import/parse/screens";
import type { ExtractedJson, ScreenItem } from "../src/ai-import/types";
import { plainLine } from "../src/ai-import/parse/types";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";
import { makeDocx, makeImage } from "./helpers/import-fixtures";

// "Ekran rasmi" fayli: savollar imtihon dasturi ekranlarida, matnda faqat qisqa javoblar (AI mock).
const ADMIN = "e2e-aiscreens";
const PASSWORD = "Ai-Screens-Admin-77";
const GROUP = "E2E-ekran rasmlari";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
let create: ReturnType<typeof vi.fn>;

const SCREENS = [
  // 1: yashil javob fayldagi javobga mos, rasm bor
  { number: 1, question: "Тротуарда тўхташга қаерда рухсат этилади?", options: ["Ҳеч қаерда", "Тротуарда ёки йўл ёқасида", "Фақат йўлда"], correctIndex: 1, picture: true },
  // 2: yashil F1, fayldagi javob F2 — zid
  { number: 2, question: "Қайси жавобда йўналишлар тўғри кўрсатилган?", options: ["«А»", "«А» ва «Б»", "«В»"], correctIndex: 0, picture: true },
  // 3: ekranda belgi yo'q — fayldagi javob ishlatiladi, rasm yo'q
  { number: 3, question: "Тўхташ усули қандай?", options: ["Бир", "Икки усули", "Уч"], correctIndex: null, picture: false },
];

function http() {
  return request(app.getHttpServer());
}

let screenCall = 0;
function mockReply(body: { system: { text: string }[]; messages: { content: { type: string; text?: string }[] }[] }) {
  const system = body.system[0].text;
  const lastText = [...body.messages[0].content].reverse().find((b) => b.type === "text")?.text ?? "";
  let out: unknown;
  if (system.includes("You read screenshots")) {
    const size = /Image size: (\d+)×(\d+)/.exec(lastText);
    const w = Number(size?.[1]);
    const h = Number(size?.[2]);
    const s = SCREENS[screenCall++ % SCREENS.length];
    out = { isQuestion: true, number: s.number, ticket: 4, question: s.question, options: s.options, correctIndex: s.correctIndex, picture: s.picture ? { x: 10, y: Math.round(h * 0.2), w: Math.round(w * 0.45), h: Math.round(h * 0.6) } : null, problems: [] };
  } else if (system.includes("checking driving-licence exam questions")) {
    const items = JSON.parse(lastText) as { id: string; options: string[]; fileAnswer: number | null }[];
    out = {
      results: items.map((i) => ({
        id: i.id,
        correctIndex: i.fileAnswer ?? 0,
        doubt: null,
        guessReason: null,
        questionKey: null,
        answerKey: null,
        explanation: "Qoidaga muvofiq.",
        ru: { text: "Вопрос", options: i.options.map((_, k) => `Вариант ${k + 1}`), explanation: "Пояснение." },
        confidence: "high",
        problems: [],
      })),
    };
  } else if (system.includes("Find ONLY overlays")) out = { boxes: [] };
  else if (system.includes("AFTER watermark removal")) out = { residue: false, smudge: false, note: null };
  else throw new Error(`kutilmagan AI so'rovi: ${system.slice(0, 60)}`);
  return { model: "claude-sonnet-5-5", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(out) }], usage: { input_tokens: 1500, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
}

async function stepUntil(batchId: string, done: (status: string) => boolean, max = 60) {
  let last: { status: string; stats: Record<string, unknown> } = { status: "", stats: {} };
  for (let i = 0; i < max; i++) {
    last = (await http().post(`/admin/ai-imports/${batchId}/step`).set(admin).expect(200)).body;
    if (done(last.status)) return last;
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
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.63.0.1");
  create = vi.fn(async (body) => mockReply(body));
  (app.get(AiService) as unknown as { client: unknown }).client = { beta: { messages: { create } } };
});

afterAll(async () => {
  await prisma.importBatch.deleteMany({ where: { group: { name: GROUP } } });
  await prisma.testGroup.deleteMany({ where: { name: GROUP } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  delete process.env.ANTHROPIC_API_KEY;
  (app.get(AiService) as unknown as { client: unknown }).client = null;
  await app.close();
});

describe("Ekran rasmlaridan import", () => {
  it("raqamlangan qisqa javoblar: qator ichida va javob ichidagi son bilan", () => {
    const answers = numberedAnswers([plainLine("4. билет"), plainLine("1.тротурарда ёки йўл ёқасида2.А ва Б"), plainLine("5.мотоцикл6.мотциклга7.Фаққат чапга8.берилмаса 9.4м10.тақиқланади"), plainLine("15,яшил кўк ва қизил")]);
    expect(answers.get(1)).toBe("тротурарда ёки йўл ёқасида");
    expect(answers.get(2)).toBe("А ва Б");
    // 3–4 tushib qolgan — 5 dan davom etadi
    expect(answers.has(3)).toBe(false);
    expect(answers.get(5)).toBe("мотоцикл");
    expect(answers.get(15)).toBeUndefined();
    const full = numberedAnswers([plainLine("1.a 2.b 3.c 4.d 5.мотоцикл6.мотциклга7.Фаққат чапга8.берилмаса 9.4м10.тақиқланади")]);
    expect(full.get(9)).toBe("4м");
    expect(full.get(10)).toBe("тақиқланади");
  });

  it("kalit so'z qo'shtirnoqlari butun, yashirin defis olib tashlanadi", () => {
    const screen = (question: string, options: string[], correctIndex: number): ScreenItem => ({ ref: "r", key: "k", imageId: null, attempts: 1, error: null, result: { isQuestion: true, number: 1, ticket: 4, question, options, correctIndex, picture: null, problems: [] } });
    const ex = { screenAnswers: { "1": "А ва Б" }, ticket: 4 } as unknown as ExtractedJson;
    const [q] = screensToQuestions(ex, [screen("Рухсат берила\u00ADдими?", ["« А »", "« А » ва « Б »"], 1)], true);
    expect(q.text).toBe("Рухсат бериладими?");
    expect(q.answerKey).toBe("« А » ва « Б »");
    expect(q.doubt ?? null).toBeNull();
  });

  it("ekranlar → AI o'qiydi → bilet testi; yashil javob, fayldagi javob bilan solishtirish, kesilgan rasm", async () => {
    const images: Record<string, Buffer> = {};
    for (let i = 1; i <= 3; i++) images[`image${i}.png`] = await makeImage({ width: 1000, height: 400, seed: i });
    const docx = await makeDocx(["4. билет", { image: "image1.png" }, "1.тротуарда ёки йўл ёқасида", { image: "image2.png" }, "2.А ва Б", { image: "image3.png" }, "3.усули"], images);
    const name = "4билет жавоби ва калит.docx";
    const created = (await http().post("/admin/ai-imports").set(admin).send({ newGroupName: GROUP, removeWatermarks: false, files: [{ name, size: docx.length }] }).expect(201)).body;
    await http().post(`/admin/ai-imports/${created.batchId}/files/${created.uploads[0].fileId}/upload`).set(admin).attach("file", docx, name).expect(204);
    const ready = await stepUntil(created.batchId, (s) => s === "ready");
    expect((ready.stats.estimate as { questions: number }).questions).toBe(3);

    await http().post(`/admin/ai-imports/${created.batchId}/start`).set(admin).expect(200);
    const done = await stepUntil(created.batchId, (s) => s === "review" || s === "partial_error");
    expect(done.status).toBe("review");

    const detail = (await http().get(`/admin/ai-imports/${created.batchId}`).set(admin).expect(200)).body;
    expect(detail.files[0].kind).toBe("screenshots");
    expect(detail.tests).toHaveLength(1);
    expect(detail.tests[0].title).toBe("4-bilet");
    // Tasnif uchun AI chaqirilmaydi; har bir ekran bir marta o'qiladi.
    const systems = create.mock.calls.map((c) => (c[0] as { system: { text: string }[] }).system[0].text);
    expect(systems.filter((s) => s.includes("You classify files"))).toHaveLength(0);
    expect(systems.filter((s) => s.includes("You read screenshots"))).toHaveLength(3);

    const qs = (await http().get(`/admin/ai-imports/${created.batchId}/tests/${detail.tests[0].id}/questions`).set(admin).expect(200)).body.items as {
      data: { text: { cyrl: string; latn: string }; correctIndex: number | null; correctBy: string; aiDoubt: string | null; keywords: { answer: string | null } };
      image: unknown;
    }[];
    expect(qs).toHaveLength(3);
    expect(qs[0].data).toMatchObject({ correctIndex: 1, correctBy: "highlight", aiDoubt: null });
    expect(qs[0].data.text.latn).toContain("Trotuar");
    expect(qs[0].data.keywords.answer).toBe("Тротуарда ёки йўл ёқасида");
    expect(qs[0].image).toBeTruthy();
    expect(qs[1].data.correctIndex).toBe(0);
    expect(qs[1].data.aiDoubt).toMatch(/yashil F1.*F2/);
    expect(qs[2].data).toMatchObject({ correctIndex: 1, correctBy: "line" });
    expect(qs[2].image).toBeFalsy();
    // Kesilgan rasm — ekranning faqat chap qismi (45% × 60%).
    const img = await prisma.importImage.findMany({ where: { batchId: created.batchId } });
    expect(img).toHaveLength(2);
  });
});
