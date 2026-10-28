import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { TEST_ACCESS_CODE, configureAdminEnv, createTestAdmin, proxyHeaders } from "./helpers/admin";

// Admin kirishi: maxsus kod + login + parol, proxy kaliti, sessiya, rate limit.
const LOGIN = "e2e-owner";
const PASSWORD = "Correct-Horse-42!";

let app: INestApplication;
let prisma: PrismaService;

function http() {
  return request(app.getHttpServer());
}

function login(body: Record<string, string>, ip: string) {
  return http().post("/admin/auth/login").set(proxyHeaders(ip)).send(body);
}

beforeAll(async () => {
  await configureAdminEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await prisma.adminLoginAttempt.deleteMany({});
  await createTestAdmin(prisma, LOGIN, PASSWORD);
});

afterAll(async () => {
  await prisma.adminLoginAttempt.deleteMany({});
  await prisma.admin.deleteMany({ where: { login: { startsWith: "e2e-" } } });
  await app.close();
});

describe("admin guard", () => {
  it("proxy kalitisiz admin API yopiq (403), oddiy foydalanuvchi tokeni ham yordam bermaydi", async () => {
    const { token } = await app.get(AuthService).createAnonymousSession();
    await http().get("/admin/auth/me").expect(403);
    await http().get("/admin/auth/me").set("Authorization", `Bearer ${token}`).expect(403);
    await http().get("/admin/audit").set("Authorization", `Bearer ${token}`).expect(403);
    await http().post("/admin/auth/login").send({ accessCode: TEST_ACCESS_CODE, login: LOGIN, password: PASSWORD }).expect(403);
    await http().get("/admin/auth/me").set("x-admin-proxy-key", "wrong").expect(403);
  });

  it("proxy kaliti bor, sessiya yo'q — 401", async () => {
    await http().get("/admin/auth/me").set(proxyHeaders()).expect(401);
    await http().get("/admin/auth/me").set({ ...proxyHeaders(), "x-admin-session": "x".repeat(43) }).expect(401);
  });
});

describe("admin login", () => {
  it("noto'g'ri kod yoki parol bilan kira olmaydi, xabar bir xil", async () => {
    const badCode = await login({ accessCode: "WRONG000", login: LOGIN, password: PASSWORD }, "10.1.0.1").expect(401);
    const badPassword = await login({ accessCode: TEST_ACCESS_CODE, login: LOGIN, password: "wrong-password" }, "10.1.0.2").expect(401);
    const badLogin = await login({ accessCode: TEST_ACCESS_CODE, login: "e2e-nobody", password: PASSWORD }, "10.1.0.3").expect(401);
    expect((badCode.body as { message: string }).message).toBe((badPassword.body as { message: string }).message);
    expect((badLogin.body as { message: string }).message).toBe((badPassword.body as { message: string }).message);
    const reasons = await prisma.adminLoginAttempt.findMany({ where: { ip: { startsWith: "10.1.0." } }, orderBy: { ip: "asc" } });
    expect(reasons.map((r) => r.reason)).toEqual(["bad_code", "bad_credentials", "bad_credentials"]);
  });

  it("to'g'ri ma'lumot bilan kiradi; logout sessiyani bekor qiladi", async () => {
    const res = await login({ accessCode: TEST_ACCESS_CODE, login: LOGIN, password: PASSWORD }, "10.2.0.1").expect(200);
    const token = (res.body as { token: string }).token;
    expect(token.length).toBeGreaterThan(30);
    const headers = { ...proxyHeaders("10.2.0.1"), "x-admin-session": token };
    const me = await http().get("/admin/auth/me").set(headers).expect(200);
    expect(me.body).toMatchObject({ login: LOGIN, role: "OWNER" });
    expect(JSON.stringify(me.body)).not.toContain("passwordHash");
    await http().post("/admin/auth/logout").set(headers).expect(204);
    await http().get("/admin/auth/me").set(headers).expect(401);
  });

  it("IP bo'yicha: 5 ta xatodan keyin to'g'ri parol ham 429", async () => {
    const ip = "10.3.0.1";
    // Har urinish boshqa loginga — faqat IP cheklovi ishlashi uchun.
    for (let i = 0; i < 5; i++) await login({ accessCode: TEST_ACCESS_CODE, login: `e2e-ghost${i}`, password: "bad" }, ip).expect(401);
    const blocked = await login({ accessCode: TEST_ACCESS_CODE, login: LOGIN, password: PASSWORD }, ip).expect(429);
    expect((blocked.body as { code: string }).code).toBe("ADMIN_LOGIN_RATE_LIMITED");
    await login({ accessCode: TEST_ACCESS_CODE, login: LOGIN, password: PASSWORD }, "10.3.0.2").expect(200);
  });

  it("login bo'yicha: turli IP'lardan 5 ta xato — shu login bloklanadi", async () => {
    const target = "e2e-target";
    await createTestAdmin(prisma, target, PASSWORD);
    for (let i = 0; i < 5; i++) await login({ accessCode: TEST_ACCESS_CODE, login: target, password: "bad" }, `10.4.0.${i + 1}`).expect(401);
    await login({ accessCode: TEST_ACCESS_CODE, login: target, password: PASSWORD }, "10.4.1.1").expect(429);
  });

  it("parolni o'zgartirish: eski parol bilan kirib bo'lmaydi, boshqa sessiyalar yopiladi", async () => {
    const user = "e2e-changer";
    await createTestAdmin(prisma, user, PASSWORD);
    const a = (await login({ accessCode: TEST_ACCESS_CODE, login: user, password: PASSWORD }, "10.5.0.1").expect(200)).body as { token: string };
    const b = (await login({ accessCode: TEST_ACCESS_CODE, login: user, password: PASSWORD }, "10.5.0.2").expect(200)).body as { token: string };
    const headersA = { ...proxyHeaders("10.5.0.1"), "x-admin-session": a.token };
    await http().post("/admin/auth/change-password").set(headersA).send({ currentPassword: "nope", newPassword: "New-Password-123" }).expect(400);
    await http().post("/admin/auth/change-password").set(headersA).send({ currentPassword: PASSWORD, newPassword: "short" }).expect(400);
    await http().post("/admin/auth/change-password").set(headersA).send({ currentPassword: PASSWORD, newPassword: "New-Password-123" }).expect(204);
    await http().get("/admin/auth/me").set(headersA).expect(200);
    await http().get("/admin/auth/me").set({ ...proxyHeaders("10.5.0.2"), "x-admin-session": b.token }).expect(401);
    await login({ accessCode: TEST_ACCESS_CODE, login: user, password: PASSWORD }, "10.5.0.3").expect(401);
    await login({ accessCode: TEST_ACCESS_CODE, login: user, password: "New-Password-123" }, "10.5.0.4").expect(200);
  });

  it("audit logda kirish va parol o'zgarishi yozilgan", async () => {
    const actions = await prisma.auditLog.findMany({ where: { action: { in: ["admin.login", "admin.password_changed"] } } });
    expect(actions.some((a) => a.action === "admin.login")).toBe(true);
    expect(actions.some((a) => a.action === "admin.password_changed")).toBe(true);
  });
});
