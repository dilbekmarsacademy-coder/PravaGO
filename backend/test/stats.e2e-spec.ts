import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

const ADMIN = "e2e-stats";
const PASSWORD = "Stats-Admin-12345";
const VISITOR = "e2e-visitor-0001";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;

function http() {
  return request(app.getHttpServer());
}

beforeAll(async () => {
  await configureAdminEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await prisma.analyticsEvent.deleteMany({ where: { visitorId: VISITOR } });
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.50.0.1");
});

afterAll(async () => {
  await prisma.analyticsEvent.deleteMany({ where: { visitorId: VISITOR } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  await app.close();
});

describe("statistika", () => {
  it("hodisalar batch bilan, sessiyasiz qabul qilinadi; shaxsiy ma'lumot saqlanmaydi", async () => {
    await http()
      .post("/events")
      .set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile")
      .send({
        visitorId: VISITOR,
        sessionId: "e2e-session-0001",
        events: [
          { type: "session_start" },
          { type: "page_view", path: "/kabinet?phone=998901234567" },
          { type: "test_start", topicSlug: "day1-topic1" },
        ],
      })
      .expect(204);
    await http().post("/events").send({ visitorId: VISITOR, sessionId: "e2e-session-0001", events: [{ type: "hack" }] }).expect(400);
    await http().post("/events").send({ visitorId: "x", sessionId: "e2e-session-0001", events: [] }).expect(400);
    const rows = await prisma.analyticsEvent.findMany({ where: { visitorId: VISITOR } });
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.type === "page_view")?.path).toBe("/kabinet");
    expect(rows[0].device).toBe("mobile");
  });

  it("dashboard yig'ma ko'rsatkichlarni qaytaradi; admin bo'lmasa yopiq", async () => {
    await http().get("/admin/stats/dashboard").expect(403);
    const res = await http().get("/admin/stats/dashboard?range=7d").set(admin).expect(200);
    expect(res.body.active.dau).toBeGreaterThanOrEqual(1);
    expect(res.body).toHaveProperty("funnel.days");
    expect(res.body.abandoned.some((a: { slug: string }) => a.slug === "day1-topic1")).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/\+998\d{9}/);
    await http().get("/admin/stats/dashboard?range=today").set(admin).expect(200);
  });

  it("AI hisobot: kalit yo'q bo'lsa 503; cron sirsiz 401", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect((await http().get("/admin/ai/reports").set(admin).expect(200)).body.configured).toBe(false);
    await http().post("/admin/ai/reports").set(admin).expect(503);
    await http().get("/cron/weekly-report").expect(401);
    if (saved) process.env.ANTHROPIC_API_KEY = saved;
  });
});
