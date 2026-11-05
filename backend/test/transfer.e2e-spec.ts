import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService, hashToken } from "../src/auth/auth.service";
import { TRANSFER_CODE_TTL_MS } from "../src/auth/transfer.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// Domen ko'chishi: eski manzilda bir martalik kod → yangi manzilda yangi sessiya.
const OLD = "https://pravatayyor.vercel.app";
const NEW = "https://www.pravaishonch.uz";
const ADMIN = "e2e-transferadmin";
const ADMIN_PASSWORD = "Transfer-Admin-Pass-77";
const PHONE_PREFIX = "+99877100";

let app: INestApplication;
let prisma: PrismaService;
let phoneSeq = 0;

function http() {
  return request(app.getHttpServer());
}

async function selfUser(): Promise<{ auth: { Authorization: string }; userId: string }> {
  const { token } = await app.get(AuthService).createAnonymousSession();
  const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  return { auth: { Authorization: `Bearer ${token}` }, userId: session.userId };
}

async function getCode(auth: Record<string, string>): Promise<string> {
  const res = await http().post("/auth/transfer-code").set(auth).set("Origin", OLD).expect(200);
  return (res.body as { code: string }).code;
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
});

afterAll(async () => {
  await prisma?.user.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
  await prisma?.admin.deleteMany({ where: { login: ADMIN } });
  await app?.close();
});

describe("transfer-code (eski domen)", () => {
  it("sessiyasiz — 401; boshqa Origin — 403; kod faqat xesh bilan, 60 soniya", async () => {
    await http().post("/auth/transfer-code").set("Origin", OLD).expect(401);
    const { auth, userId } = await selfUser();
    await http().post("/auth/transfer-code").set(auth).expect(403);
    await http().post("/auth/transfer-code").set(auth).set("Origin", NEW).expect(403);
    await http().post("/auth/transfer-code").set(auth).set("Origin", "https://evil.example").expect(403);

    const res = await http().post("/auth/transfer-code").set(auth).set("Origin", OLD).expect(200);
    const { code, expiresAt } = res.body as { code: string; expiresAt: string };
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bayt
    const ttl = new Date(expiresAt).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(TRANSFER_CODE_TTL_MS - 5_000);
    expect(ttl).toBeLessThanOrEqual(TRANSFER_CODE_TTL_MS);
    const rows = await prisma.sessionTransferCode.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].codeHash).toBe(hashToken(code));
    expect(JSON.stringify(rows)).not.toContain(code);
  });

  it("admin panel sessiyasi bilan — 403", async () => {
    const admin = await adminHeaders(app, ADMIN, ADMIN_PASSWORD, "10.31.0.1");
    const { auth } = await selfUser();
    const res = await http().post("/auth/transfer-code").set(admin).set(auth).set("Origin", OLD).expect(403);
    expect(res.body).toMatchObject({ code: "ADMIN_NOT_TRANSFERABLE" });
  });
});

describe("rate limit", () => {
  it("bitta sessiya daqiqasiga 5 tadan ortiq kod ololmaydi — 429", async () => {
    const { auth } = await selfUser();
    for (let i = 0; i < 5; i++) await getCode(auth);
    await http().post("/auth/transfer-code").set(auth).set("Origin", OLD).expect(429);
  });
});

describe("transfer-exchange (yangi domen)", () => {
  it("kod bir marta ishlaydi: o'sha foydalanuvchiga yangi sessiya, ikkinchi marta 401", async () => {
    const { auth, userId } = await selfUser();
    const code = await getCode(auth);
    await http().post("/auth/transfer-exchange").set("Origin", OLD).send({ code }).expect(403);
    const res = await http().post("/auth/transfer-exchange").set("Origin", NEW).send({ code }).expect(200);
    const { token, center } = res.body as { token: string; center: boolean };
    expect(center).toBe(false);
    const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
    expect(session.userId).toBe(userId);
    // Yangi token ishlaydi, eski ham (SELF — bitta qurilma qoidasi yo'q).
    await http().get("/me").set("Authorization", `Bearer ${token}`).expect(200);
    await http().get("/me").set(auth).expect(200);
    expect(await prisma.sessionTransferCode.count({ where: { userId } })).toBe(0);

    const again = await http().post("/auth/transfer-exchange").set("Origin", NEW).send({ code }).expect(401);
    expect(again.body).toMatchObject({ code: "TRANSFER_CODE_INVALID" });
  });

  it("60 soniyadan keyin — 401 va kod o'chiriladi; noto'g'ri format — 400; soxta kod — 401", async () => {
    const { auth, userId } = await selfUser();
    const code = await getCode(auth);
    await prisma.sessionTransferCode.updateMany({ where: { userId }, data: { expiresAt: new Date(Date.now() - 1) } });
    await http().post("/auth/transfer-exchange").set("Origin", NEW).send({ code }).expect(401);
    expect(await prisma.sessionTransferCode.count({ where: { userId } })).toBe(0);

    await http().post("/auth/transfer-exchange").set("Origin", NEW).send({ code: "short" }).expect(400);
    await http().post("/auth/transfer-exchange").set("Origin", NEW).send({ code: "A".repeat(43) }).expect(401);
  });

  it("markaz o'quvchisi: yangi sessiya yagona faol sessiya, eski domendagi sessiya SESSION_REPLACED", async () => {
    const { token: oldToken } = await app.get(AuthService).createAnonymousSession();
    const oldSession = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(oldToken) } });
    phoneSeq += 1;
    await prisma.user.update({
      where: { id: oldSession.userId },
      data: { type: "CENTER", phone: `${PHONE_PREFIX}${String(phoneSeq).padStart(4, "0")}`, login: `e2e-transfer-${phoneSeq}`, activeSessionId: oldSession.id },
    });
    const oldAuth = { Authorization: `Bearer ${oldToken}` };
    await http().get("/me").set(oldAuth).expect(200);

    const code = await getCode(oldAuth);
    const res = await http().post("/auth/transfer-exchange").set("Origin", "https://pravaishonch.uz").send({ code }).expect(200);
    const { token, center } = res.body as { token: string; center: boolean };
    expect(center).toBe(true);
    const fresh = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: oldSession.userId } });
    expect(user.activeSessionId).toBe(fresh.id);
    await http().get("/me").set("Authorization", `Bearer ${token}`).expect(200);
    const replaced = await http().get("/me").set(oldAuth).expect(401);
    expect(replaced.body).toMatchObject({ code: "SESSION_REPLACED" });
  });

  it("faolsizlantirilgan akkaunt — 403", async () => {
    const { auth, userId } = await selfUser();
    const code = await getCode(auth);
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    await http().post("/auth/transfer-exchange").set("Origin", NEW).send({ code }).expect(403);
  });
});
