import "reflect-metadata";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { basename } from "path";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// HAQIQIY Claude API bilan istalgan bitta fayl (lokal test bazasida). Faqat qo'lda:
//   REAL_AI=1 REAL_FILE=/yo'l/fayl.docx ANTHROPIC_API_KEY=... npx vitest run test/ai-real-file.e2e-spec.ts
// Natija (test/output/real-file-report.txt): har bir savol (raqam, javob, manba, rasm, ogohlantirish) va xarajat. Kalit chiqarilmaydi.
const file = process.env.REAL_FILE;
const enabled = process.env.REAL_AI === "1" && Boolean(process.env.ANTHROPIC_API_KEY) && Boolean(file);
const ADMIN = "e2e-airealfile";
const PASSWORD = "Ai-Real-File-2026";
const GROUP = "E2E-real fayl";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;

describe.skipIf(!enabled)("Haqiqiy AI: berilgan fayl", () => {
  beforeAll(async () => {
    await configureAdminEnv();
    process.env.STORAGE_LOCAL_DIR = `${process.cwd()}/test/output/storage`;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await createTestAdmin(prisma, ADMIN, PASSWORD);
    admin = await adminHeaders(app, ADMIN, PASSWORD, "10.64.0.1");
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.importBatch.deleteMany({ where: { group: { name: GROUP } } });
    await prisma.testGroup.deleteMany({ where: { name: GROUP } });
    await prisma.admin.deleteMany({ where: { login: ADMIN } });
    await app.close();
  });

  it("yuklash → AI → tekshiruv; savollar va xarajat chiqariladi", { timeout: 900_000 }, async () => {
    const data = readFileSync(file!);
    const name = basename(file!);
    const http = () => request(app.getHttpServer());
    const created = (await http().post("/admin/ai-imports").set(admin).send({ newGroupName: GROUP, removeWatermarks: false, files: [{ name, size: data.length }] }).expect(201)).body;
    await http().post(`/admin/ai-imports/${created.batchId}/files/${created.uploads[0].fileId}/upload`).set(admin).attach("file", data, name).expect(204);
    let status = "";
    for (let i = 0; i < 60 && status !== "ready"; i++) status = (await http().post(`/admin/ai-imports/${created.batchId}/step`).set(admin).expect(200)).body.status;
    expect(status).toBe("ready");
    await http().post(`/admin/ai-imports/${created.batchId}/start`).set(admin).expect(200);
    for (let i = 0; i < 200 && !["review", "partial_error", "paused"].includes(status); i++) status = (await http().post(`/admin/ai-imports/${created.batchId}/step`).set(admin).expect(200)).body.status;
    const detail = (await http().get(`/admin/ai-imports/${created.batchId}`).set(admin).expect(200)).body;
    const lines = [`Holat: ${detail.status}${detail.error ? ` (${detail.error})` : ""}; fayl turi: ${detail.files.map((f: { kind: string }) => f.kind).join(", ")}`];
    for (const t of detail.tests as { id: string; title: string }[]) {
      const qs = (await http().get(`/admin/ai-imports/${created.batchId}/tests/${t.id}/questions`).set(admin).expect(200)).body.items as {
        number: number | null;
        image: unknown;
        data: { text: { cyrl: string }; options: { cyrl: string }[]; correctIndex: number | null; correctBy: string | null; aiDoubt: string | null; keywords: { answer: string | null }; problems: string[] };
      }[];
      lines.push(`\nTest "${t.title}": ${qs.length} ta savol`);
      for (const q of qs) {
        const d = q.data;
        const ans = d.correctIndex !== null ? `F${d.correctIndex + 1} «${d.options[d.correctIndex]?.cyrl.slice(0, 40)}» (${d.correctBy})` : "javob yo'q";
        lines.push(`${q.number ?? "?"}. ${d.text.cyrl.slice(0, 70)} | ${d.options.length} variant | ${ans} | rasm: ${q.image ? "bor" : "yo'q"}${d.keywords.answer ? ` | kalit: ${d.keywords.answer}` : ""}${d.aiDoubt ? ` | ⚠ ${d.aiDoubt}` : ""}${d.problems.length ? ` | muammo: ${d.problems.join("; ")}` : ""}`);
      }
    }
    const usage = await prisma.aiUsage.groupBy({ by: ["feature"], where: { batchId: created.batchId }, _sum: { costUsd: true }, _count: { _all: true } });
    lines.push(`\nXarajat: ${usage.map((u) => `${u.feature} ${u._count._all} ta $${(u._sum.costUsd ?? 0).toFixed(4)}`).join(", ")}; jami $${usage.reduce((s, u) => s + (u._sum.costUsd ?? 0), 0).toFixed(4)}`);
    mkdirSync(`${process.cwd()}/test/output`, { recursive: true });
    writeFileSync(`${process.cwd()}/test/output/real-file-report.txt`, lines.join("\n") + "\n");
    expect(detail.status).toBe("review");
  });
});
