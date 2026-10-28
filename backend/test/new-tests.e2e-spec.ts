import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// "Yangi testlar": to'plam → rasm (tozalash vazifasi) → savol → nashr → foydalanuvchi yechadi.
const ADMIN = "e2e-newtests";
const PASSWORD = "NewTests-Admin-55";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
let collectionId: string;
let slug: string;

function http() {
  return request(app.getHttpServer());
}

async function waitJob(id: string): Promise<{ status: string; outputAssetId: string | null; result: { steps: string[] } }> {
  for (let i = 0; i < 60; i++) {
    const res = await http().get(`/admin/images/jobs/${id}`).set(admin).expect(200);
    if (res.body.status === "done" || res.body.status === "failed") return res.body;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("job timeout");
}

const question = (imageAssetId?: string) => ({
  text: { cyrl: "Қайси белги ўрнатилган?", latn: "Qaysi belgi oʻrnatilgan?", ru: "" },
  options: [
    { text: { cyrl: "Тўхташ тақиқланган", latn: "Toʻxtash taqiqlangan", ru: "" } },
    { text: { cyrl: "Кириш тақиқланган", latn: "Kirish taqiqlangan", ru: "" } },
  ],
  correctIndex: 1,
  keywords: { none: false, answer: { cyrl: [[0, 5]], uz: [[0, 6]] } },
  ...(imageAssetId ? { imageAssetId } : {}),
});

beforeAll(async () => {
  await configureAdminEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.40.0.1");
});

afterAll(async () => {
  await prisma.topic.deleteMany({ where: { kind: "collection", title: { startsWith: "E2E" } } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  await app.close();
});

describe("yangi testlar", () => {
  it("rasm yuklash: rasm bo'lmagan fayl rad etiladi", async () => {
    await http().post("/admin/images").set(admin).attach("file", Buffer.from("not an image"), { filename: "x.png", contentType: "image/png" }).expect(400);
    await http().post("/admin/images").set(admin).attach("file", Buffer.from("hello"), { filename: "x.txt", contentType: "text/plain" }).expect(400);
  });

  it("to'plam, rasm bilan savol, nashr va foydalanuvchi yechishi", async () => {
    const col = await http().post("/admin/collections").set(admin).send({ title: { uz: "E2E to'plam", cyrl: "E2E тўплам", ru: "E2E набор" } }).expect(201);
    collectionId = col.body.id;
    slug = col.body.slug;
    expect(slug).toMatch(/^new-/);

    // Oq ramkali rasm — avtomatik tozalashda chetlari kesiladi.
    const png = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#ffffff" } })
      .composite([{ input: await sharp({ create: { width: 200, height: 150, channels: 3, background: "#d02020" } }).png().toBuffer(), left: 100, top: 75 }])
      .png()
      .toBuffer();
    const up = await http().post("/admin/images").set(admin).attach("file", png, { filename: "sign.png", contentType: "image/png" }).expect(201);
    const job = await waitJob(up.body.job.id);
    expect(job.status).toBe("done");
    expect(job.result.steps.join(" ")).toContain("chetlar kesildi");
    const out = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: job.outputAssetId! } });
    expect(out).toMatchObject({ public: false, mime: "image/webp", width: 200, height: 150 });

    // Tasdiqlanmagan va asl rasm ommaga ochiq emas.
    await http().get(`/media/${job.outputAssetId}.webp`).expect(404);
    await http().get(`/media/${up.body.asset.id}.webp`).expect(404);
    await http().post("/admin/images/accept").set(admin).send({ assetId: up.body.asset.id }).expect(400);
    const accepted = await http().post("/admin/images/accept").set(admin).send({ assetId: job.outputAssetId }).expect(200);
    const media = await http().get(accepted.body.url).expect(200);
    expect(media.headers["content-type"]).toBe("image/webp");

    const manual = await http()
      .post("/admin/images/jobs")
      .set(admin)
      .send({ inputAssetId: up.body.asset.id, type: "manual", erase: [{ x: 0.3, y: 0.3, w: 0.1, h: 0.1 }], crop: { x: 0, y: 0, w: 0.5, h: 0.5 } })
      .expect(201);
    expect((await waitJob(manual.body.id)).status).toBe("done");

    const q = await http().post(`/admin/collections/${collectionId}/questions`).set(admin).send(question(job.outputAssetId!)).expect(201);
    expect(q.body).toMatchObject({ correctIndex: 1, ruNeedsReview: true, image: { url: `/media/${job.outputAssetId}.webp` } });

    // Nashr qilinmagan — foydalanuvchiga ko'rinmaydi.
    const { token } = await app.get(AuthService).createAnonymousSession();
    const user = { Authorization: `Bearer ${token}` };
    expect((await http().get("/collections").set(user).expect(200)).body).toEqual([]);
    await http().get(`/topics/${slug}/questions`).set(user).expect(404);

    await http().patch(`/admin/collections/${collectionId}`).set(admin).send({ published: true }).expect(200);
    const list = await http().get("/collections").set(user).expect(200);
    expect(list.body).toEqual([expect.objectContaining({ slug, questionCount: 1, bestPercent: null })]);

    const questions = await http().get(`/topics/${slug}/questions`).set(user).expect(200);
    expect(JSON.stringify(questions.body)).not.toMatch(/isCorrect|correctOptionId|keyword/i);
    const qq = questions.body[0] as { id: string; options: { id: string }[] };
    const check = await http().post(`/questions/${qq.id}/check-answer`).set(user).send({ optionId: qq.options[1].id }).expect(200);
    expect(check.body.correct).toBe(true);
    await http().post(`/topics/${slug}/attempts`).set(user).send({ answers: [{ questionId: qq.id, optionId: qq.options[1].id }] }).expect(201);
    expect((await http().get("/collections").set(user).expect(200)).body[0]).toMatchObject({ bestPercent: 100, passed: true });
  });

  it("dublikat ogohlantiruvi va yumshoq o'chirish", async () => {
    const similar = await http().post("/admin/questions/similar").set(admin).send({ text: "Qaysi belgi o'rnatilgan" }).expect(200);
    expect(similar.body.length).toBeGreaterThan(0);
    const { items } = (await http().get(`/admin/collections/${collectionId}/questions`).set(admin).expect(200)).body as { items: { id: string }[] };
    await http().delete(`/admin/questions/${items[0].id}`).set(admin).expect(204);
    expect((await http().get(`/admin/collections/${collectionId}/questions`).set(admin).expect(200)).body.items).toHaveLength(0);
  });

  it("AI sozlanmagan bo'lsa — status false, tarjima 503", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect((await http().get("/admin/ai/status").set(admin).expect(200)).body).toEqual({ configured: false });
    await http().post("/admin/ai/translate").set(admin).send({ text: "Savol", options: ["A", "B"] }).expect(503);
    if (saved) process.env.ANTHROPIC_API_KEY = saved;
  });
});
