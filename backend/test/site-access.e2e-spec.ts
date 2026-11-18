import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService, hashToken } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// Saytni foydalanuvchi uchun yopish: login rad etiladi, mavjud sessiya har
// so'rovda 403 SITE_CLOSED oladi; ochilgach qayta kiradi. Natija va to'lovlarga tegmaydi.
const ADMIN = "e2e-siteaccess-admin";
const ADMIN_PASSWORD = "Site-Access-Admin-55";
const PHONE_PREFIX = "+99877100";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
let seq = 0;

function http() {
  return request(app.getHttpServer());
}

function nextPhone(): string {
  seq += 1;
  return `${PHONE_PREFIX}${String(seq).padStart(4, "0")}`;
}

async function createCenter(): Promise<{ id: string; phone: string; login: string; password: string }> {
  const password = `parol-${seq + 1}-xyz`;
  const res = await http().post("/admin/students").set(admin).send({ phone: nextPhone(), password }).expect(201);
  return { ...(res.body as { id: string; phone: string; login: string }), password };
}

function centerLogin(c: { phone: string; login: string; password: string }) {
  return http().post("/auth/center/login").send({ phone: c.phone, login: c.login, password: c.password });
}

/** O'zi ro'yxatdan o'tgan foydalanuvchi (qurilma sessiyasi bilan). */
async function createSelf(): Promise<{ id: string; auth: { Authorization: string } }> {
  const { token } = await app.get(AuthService).createAnonymousSession();
  const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  await prisma.user.update({
    where: { id: session.userId },
    data: { phone: nextPhone(), firstName: "Self", lastName: "Foydalanuvchi", registeredAt: new Date(), paymentStatus: "PAID", weeklyResetExempt: true },
  });
  return { id: session.userId, auth: { Authorization: `Bearer ${token}` } };
}

function setAccess(ids: string[], blocked: boolean, reason?: string) {
  return http()
    .post("/admin/users/site-access")
    .set(admin)
    .send({ ids, blocked, ...(reason ? { reason } : {}) });
}

beforeAll(async () => {
  await configureAdminEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await prisma.user.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
  await createTestAdmin(prisma, ADMIN, ADMIN_PASSWORD);
  admin = await adminHeaders(app, ADMIN, ADMIN_PASSWORD, "10.31.0.1");
});

beforeEach(async () => {
  await prisma.userLoginAttempt.deleteMany({});
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
  await prisma.userLoginAttempt.deleteMany({});
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  await app.close();
});

describe("saytni yopish — markaz o'quvchisi", () => {
  it("yopilgan o'quvchi to'g'ri parol bilan ham kira olmaydi; kirgan qurilma keyingi so'rovda 403 SITE_CLOSED", async () => {
    const c = await createCenter();
    const res = await centerLogin(c).expect(200);
    const auth = { Authorization: `Bearer ${(res.body as { token: string }).token}` };
    await http().get("/me").set(auth).expect(200);

    const closed = await setAccess([c.id], true, "To'lov muddati o'tgan").expect(200);
    expect(closed.body).toMatchObject({ blocked: true, updated: 1, unchanged: 0, notFound: [] });

    // Keyingi har bir so'rov — 403 va aniq kod (guard'dan oldin, middleware'da).
    for (const path of ["/me", "/auth/check", "/final-exam", "/saved"]) {
      const r = await http().get(path).set(auth);
      expect(r.status).toBe(403);
      expect(r.body).toMatchObject({ code: "SITE_CLOSED" });
    }
    // Login: parol to'g'ri — baribir yo'q.
    const denied = await centerLogin(c);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe("SITE_CLOSED");
    expect(JSON.stringify(denied.body)).not.toMatch(/token/i);
    // Faol sessiya bekor qilingan.
    const row = await prisma.user.findUniqueOrThrow({ where: { id: c.id } });
    expect(row).toMatchObject({ siteAccessBlocked: true, blockReason: "To'lov muddati o'tgan", activeSessionId: null });
    expect(row.blockedAt).toBeInstanceOf(Date);

    // Bir necha marta urinish rate-limit'ga olib kelmaydi (parol to'g'ri edi).
    for (let i = 0; i < 6; i++) expect((await centerLogin(c)).status).toBe(403);

    // Ochildi: eski token qaytmaydi (sessiya bekor), qayta login ishlaydi.
    expect((await setAccess([c.id], false).expect(200)).body).toMatchObject({ blocked: false, updated: 1 });
    expect((await http().get("/me").set(auth).expect(401)).body.code).toBe("SESSION_REVOKED");
    const again = await centerLogin(c).expect(200);
    await http().get("/me").set({ Authorization: `Bearer ${(again.body as { token: string }).token}` }).expect(200);
    const opened = await prisma.user.findUniqueOrThrow({ where: { id: c.id } });
    expect(opened).toMatchObject({ siteAccessBlocked: false, blockedAt: null, blockReason: null });
  });

  it("ro'yxatda holat ko'rinadi va 'yopilganlar' filtri ishlaydi", async () => {
    const c = await createCenter();
    await setAccess([c.id], true).expect(200);
    const list = await http().get("/admin/students?status=blocked").set(admin).expect(200);
    const item = (list.body as { items: { id: string; siteAccessBlocked: boolean; blockedAt: string | null }[] }).items.find((i) => i.id === c.id);
    expect(item).toMatchObject({ siteAccessBlocked: true });
    expect(item?.blockedAt).toBeTruthy();
    const detail = await http().get(`/admin/users/${c.id}`).set(admin).expect(200);
    expect(detail.body).toMatchObject({ siteAccessBlocked: true });
    await setAccess([c.id], false).expect(200);
  });
});

describe("saytni yopish — o'zi ro'yxatdan o'tgan foydalanuvchi", () => {
  it("qurilma sessiyasi 403 SITE_CLOSED oladi, ochilgach o'sha qurilmada davom etadi; to'lov va natijalar o'zgarmaydi", async () => {
    const u = await createSelf();
    const topic = await prisma.topic.findFirst({ where: { kind: "course", deletedAt: null }, select: { id: true } });
    if (topic) await prisma.topicTestAttempt.create({ data: { userId: u.id, topicId: topic.id, correct: 9, total: 10, percent: 90 } });

    await setAccess([u.id], true).expect(200);
    const r = await http().get("/me").set(u.auth).expect(403);
    expect(r.body).toEqual({ statusCode: 403, code: "SITE_CLOSED", message: "Sayt siz uchun yopilgan. Ochish uchun admin bilan bog'laning" });
    // Sessiya o'chirilmagan — aks holda sayt yangi anonim sessiya ochib, yopishni chetlab o'tardi.
    expect(await prisma.session.count({ where: { userId: u.id } })).toBe(1);

    await setAccess([u.id], false).expect(200);
    await http().get("/me").set(u.auth).expect(200);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row).toMatchObject({ paymentStatus: "PAID", weeklyResetExempt: true, siteAccessBlocked: false });
    if (topic) expect(await prisma.topicTestAttempt.count({ where: { userId: u.id } })).toBe(1);
  });

  it("'Yangi foydalanuvchilar' ro'yxatida access filtri", async () => {
    const u = await createSelf();
    await setAccess([u.id], true).expect(200);
    const blocked = await http().get("/admin/users?access=blocked&pageSize=100").set(admin).expect(200);
    expect((blocked.body as { items: { id: string; siteAccessBlocked: boolean }[] }).items.find((i) => i.id === u.id)).toMatchObject({ siteAccessBlocked: true });
    const open = await http().get("/admin/users?access=open&pageSize=100").set(admin).expect(200);
    expect((open.body as { items: { id: string }[] }).items.some((i) => i.id === u.id)).toBe(false);
    await setAccess([u.id], false).expect(200);
  });
});

describe("ommaviy yopish va himoya", () => {
  it("bir nechta foydalanuvchini bir so'rovda yopadi/ochadi; har biri audit'ga yoziladi", async () => {
    const a = await createCenter();
    const b = await createSelf();
    const missing = "00000000-0000-4000-8000-000000000000";
    const res = await setAccess([a.id, b.id, a.id, missing], true, "Ommaviy").expect(200);
    expect(res.body).toMatchObject({ blocked: true, updated: 2, unchanged: 0, notFound: [missing] });
    // Takror yopish — o'zgarish yo'q.
    expect((await setAccess([a.id, b.id], true).expect(200)).body).toMatchObject({ updated: 0, unchanged: 2 });

    const logs = await prisma.auditLog.findMany({ where: { action: "user.site_closed", entityId: { in: [a.id, b.id] } } });
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => l.adminId !== null)).toBe(true);
    expect(JSON.stringify(logs)).not.toMatch(/password|argon2/i);

    expect((await setAccess([a.id, b.id], false).expect(200)).body).toMatchObject({ blocked: false, updated: 2 });
    expect(await prisma.auditLog.count({ where: { action: "user.site_opened", entityId: { in: [a.id, b.id] } } })).toBe(2);
  });

  it("validatsiya va faqat admin", async () => {
    await http().post("/admin/users/site-access").set(admin).send({ ids: [], blocked: true }).expect(400);
    await http().post("/admin/users/site-access").set(admin).send({ ids: ["not-a-uuid"], blocked: true }).expect(400);
    await http().post("/admin/users/site-access").set(admin).send({ ids: ["00000000-0000-4000-8000-000000000000"] }).expect(400);
    const u = await createSelf();
    // Oddiy foydalanuvchi tokeni bilan — admin endpoint yopiq.
    await http().post("/admin/users/site-access").set(u.auth).send({ ids: [u.id], blocked: true }).expect(403);
    await http().post("/admin/users/site-access").send({ ids: [u.id], blocked: true }).expect(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).siteAccessBlocked).toBe(false);
  });
});
