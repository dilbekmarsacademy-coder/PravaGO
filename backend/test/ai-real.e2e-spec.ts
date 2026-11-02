import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";
import { makeFixtureSet } from "./helpers/import-fixtures";

// HAQIQIY Claude API bilan bitta kichik fayl (3 savol, 2 rasm). Faqat qo'lda:
//   REAL_AI=1 ANTHROPIC_API_KEY=... npx vitest run test/ai-real.e2e-spec.ts
// Narxi ≈ $0.01–0.05. Kalit hech qayerga yozilmaydi va chiqarilmaydi.
const enabled = process.env.REAL_AI === "1" && Boolean(process.env.ANTHROPIC_API_KEY);
const ADMIN = "e2e-aireal";
const PASSWORD = "Ai-Real-Admin-2026";
const GROUP = "E2E-real AI";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;

describe.skipIf(!enabled)("Haqiqiy AI: bitta kichik fayl", () => {
  beforeAll(async () => {
    await configureAdminEnv();
    process.env.STORAGE_LOCAL_DIR = `${process.cwd()}/test/output/storage`;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await createTestAdmin(prisma, ADMIN, PASSWORD);
    admin = await adminHeaders(app, ADMIN, PASSWORD, "10.62.0.1");
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.importBatch.deleteMany({ where: { group: { name: GROUP } } });
    await prisma.testGroup.deleteMany({ where: { name: GROUP } });
    await prisma.admin.deleteMany({ where: { login: ADMIN } });
    await app.close();
  });

  it("yuklash → AI tahlil → tekshiruv; xarajat qayd etiladi", { timeout: 300_000 }, async () => {
    const file = (await makeFixtureSet()).files[0];
    const http = () => request(app.getHttpServer());
    const created = (await http().post("/admin/ai-imports").set(admin).send({ newGroupName: GROUP, removeWatermarks: true, files: [{ name: file.name, size: file.data.length }] }).expect(201)).body;
    await http().post(`/admin/ai-imports/${created.batchId}/files/${created.uploads[0].fileId}/upload`).set(admin).attach("file", file.data, file.name).expect(204);
    let status = "";
    for (let i = 0; i < 60 && status !== "ready"; i++) status = (await http().post(`/admin/ai-imports/${created.batchId}/step`).set(admin).expect(200)).body.status;
    expect(status).toBe("ready");
    await http().post(`/admin/ai-imports/${created.batchId}/start`).set(admin).expect(200);
    for (let i = 0; i < 60 && !["review", "partial_error", "paused"].includes(status); i++) status = (await http().post(`/admin/ai-imports/${created.batchId}/step`).set(admin).expect(200)).body.status;
    const detail = (await http().get(`/admin/ai-imports/${created.batchId}`).set(admin).expect(200)).body;
    expect(detail.status, detail.error ?? "").toBe("review");
    const qs = (await http().get(`/admin/ai-imports/${created.batchId}/tests/${detail.tests[0].id}/questions`).set(admin).expect(200)).body.items;
    expect(qs).toHaveLength(3);
    // Fayldagi qalin javob saqlanadi; AI izoh, kalit va ruscha matn yozgan.
    expect(qs[0].data).toMatchObject({ correctIndex: 1, correctSource: "file" });
    for (const q of qs) {
      expect(q.data.explanation?.latn?.length ?? 0).toBeGreaterThan(5);
      expect(q.data.text.ru.length).toBeGreaterThan(5);
    }
    // Hammasi qalin bo'lgan savol — javob AI'dan, tekshirish kerak.
    expect(qs[2].review).toBe(true);
    const usage = await prisma.aiUsage.aggregate({ where: { batchId: created.batchId }, _sum: { costUsd: true }, _count: { _all: true } });
    console.log(`AI so'rovlari: ${usage._count._all}, xarajat: $${(usage._sum.costUsd ?? 0).toFixed(4)}; rasmlar: ${qs.filter((q: { image: unknown }) => q.image).map((q: { image: { status: string; note: string | null } }) => `${q.image.status}${q.image.note ? ` (${q.image.note})` : ""}`).join(", ")}`);
    expect(usage._sum.costUsd ?? 0).toBeLessThan(0.3);
  });
});
