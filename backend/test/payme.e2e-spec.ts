import "reflect-metadata";
import { randomUUID } from "crypto";
import { INestApplication, Logger, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";

// Payme Merchant API (sandbox kaliti bilan) va checkout.
const TEST_KEY = "e2e-payme-test-key";
const PROD_KEY = "e2e-payme-prod-key";
const DAY = 86_400_000;
const H12 = 12 * 3600_000;
const STANDARD = 30_000_000;
const ENV = { PAYMENTS_ENABLED: "true", PAYME_ENV: "test", PAYME_MERCHANT_ID: "e2e-merchant", PAYME_KEY: PROD_KEY, PAYME_TEST_KEY: TEST_KEY, PAYME_TEST_USERS: "", VERCEL_ENV: "", PAYMENT_ENFORCED: "true" };

let app: INestApplication;
let prisma: PrismaService;
const userIds: string[] = [];
const http = () => request(app.getHttpServer());
const basic = (key: string, login = "Paycom") => `Basic ${Buffer.from(`${login}:${key}`).toString("base64")}`;

async function newUser(data: Record<string, unknown> = {}) {
  const { token } = await app.get(AuthService).createAnonymousSession("e2e");
  const auth = { Authorization: `Bearer ${token}` };
  const { user } = (await app.get(AuthService).resolveToken(token)) as { user: { id: string } };
  userIds.push(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { registeredAt: new Date(), firstName: "Payme", ...data } });
  return { id: user.id, auth };
}
type U = Awaited<ReturnType<typeof newUser>>;

async function newOrder(user: U, tariff = "STANDARD"): Promise<string> {
  return (await http().post("/payments/create-order").set(user.auth).send({ tariff }).expect(201)).body.id;
}
async function rpc(method: string, params: unknown, authorization: string | null = basic(TEST_KEY)) {
  const r = http().post("/payments/payme");
  if (authorization) r.set("Authorization", authorization);
  return (await r.send({ jsonrpc: "2.0", id: 7, method, params }).expect(200)).body;
}
const account = (id: string) => ({ order_id: id });
const create = (id: string, orderId: string, amount = STANDARD, time = Date.now()) => rpc("CreateTransaction", { id, time, amount, account: account(orderId) });
const until = async (u: U) => (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).subscriptionUntil;
const order = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });
async function paid(user: U, tariff = "STANDARD", amount = STANDARD) {
  const orderId = await newOrder(user, tariff);
  const id = randomUUID();
  expect((await create(id, orderId, amount)).result.state).toBe(1);
  const performed = (await rpc("PerformTransaction", { id })).result;
  expect(performed.state).toBe(2);
  return { orderId, id, performed };
}

beforeAll(async () => {
  Object.assign(process.env, ENV);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
});
beforeEach(() => void Object.assign(process.env, ENV));
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  for (const k of Object.keys(ENV)) delete process.env[k];
  process.env.PAYMENT_ENFORCED = "false";
  await app.close();
});

describe("avtorizatsiya va protokol", () => {
  it("noto'g'ri/yo'q avtorizatsiya -32504; boshqa muhit kaliti ishlamaydi; kalit yo'q bo'lsa yopiq", async () => {
    for (const h of [null, "Basic !!!", basic("xato"), basic(TEST_KEY, "Boshqa"), basic(PROD_KEY), `Bearer ${TEST_KEY}`]) {
      expect((await rpc("CheckTransaction", { id: "x" }, h)).error.code, String(h)).toBe(-32504);
    }
    process.env.PAYME_ENV = "prod";
    expect((await rpc("CheckTransaction", { id: "x" })).error.code).toBe(-32504);
    expect((await rpc("CheckTransaction", { id: "x" }, basic(PROD_KEY))).error.code).toBe(-31003);
    process.env.PAYME_KEY = "";
    expect((await rpc("CheckTransaction", { id: "x" }, basic(""))).error.code).toBe(-32504);
  });

  it("faqat POST; noma'lum metod, noto'g'ri so'rov, text/json tana", async () => {
    await http().get("/payments/payme").expect(404);
    const bad = await rpc("Nomalum", {});
    expect(bad).toMatchObject({ jsonrpc: "2.0", id: 7, error: { code: -32601, message: { uz: expect.any(String), ru: expect.any(String), en: expect.any(String) } } });
    expect((await rpc("CheckTransaction", undefined)).error.code).toBe(-32600);
    expect((await rpc("CheckTransaction", { id: 5 })).error.code).toBe(-32600);
    const raw = (body: string) => http().post("/payments/payme").set("Authorization", basic(TEST_KEY)).set("Content-Type", "text/json; charset=UTF-8").send(body).expect(200);
    expect((await raw('{"id":1,"method":"CheckTransaction","params":{"id":"x"}}')).body.error.code).toBe(-31003);
    expect((await raw("{buzuq")).body.error.code).toBe(-32700);
  });

  it("log: so'rov va javob yoziladi, kalit yozilmaydi", async () => {
    const spy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    await rpc("CheckTransaction", { id: "log-tekshiruv" });
    const text = JSON.stringify(spy.mock.calls);
    spy.mockRestore();
    expect(text).toContain("log-tekshiruv");
    expect(text).toContain("-31003");
    expect(text).not.toContain(TEST_KEY);
    expect(text).not.toContain(basic(TEST_KEY).slice(6));
  });
});

describe("CheckPerformTransaction", () => {
  it("mumkin; summa -31001; buyurtma yo'q -31050; band/to'langan -31099", async () => {
    const u = await newUser();
    const o = await newOrder(u);
    const check = (id: unknown, amount: unknown) => rpc("CheckPerformTransaction", { amount, account: { order_id: id } });
    expect((await check(o, STANDARD)).result).toEqual({ allow: true });
    for (const a of [STANDARD - 1, 300_000, String(STANDARD), undefined]) expect((await check(o, a)).error.code).toBe(-31001);
    for (const id of [randomUUID() as string, "yo'q", 12, undefined, "a\0b"]) expect((await check(id, STANDARD)).error.code).toBe(-31050);
    expect((await rpc("CheckPerformTransaction", { amount: STANDARD })).error.code).toBe(-31050);
    const id = randomUUID();
    await create(id, o);
    expect((await check(o, STANDARD)).error.code).toBe(-31099);
    await rpc("PerformTransaction", { id });
    expect((await check(o, STANDARD)).error.code).toBe(-31099);
  });
});

describe("CreateTransaction", () => {
  it("yaratadi va takrorda o'sha natija; boshqa tranzaksiya -31099; xatolar", async () => {
    const o = await newOrder(await newUser());
    const id = randomUUID();
    expect((await create(id, o, STANDARD + 100)).error.code).toBe(-31001);
    expect((await create(id, randomUUID())).error.code).toBe(-31050);
    expect((await create(id, o, STANDARD, Date.now() - H12 - 1000)).error.code).toBe(-31008);
    const time = Date.now() - 1000;
    const first = await create(id, o, STANDARD, time);
    expect(first.result).toEqual({ create_time: expect.any(Number), transaction: expect.any(String), state: 1 });
    expect((await create(id, o, STANDARD, time)).result).toEqual(first.result);
    expect((await create(randomUUID(), o)).error.code).toBe(-31099);
    expect(await prisma.paymeTransaction.count({ where: { orderId: o } })).toBe(1);
  });

  it("parallel: bir xil id — bitta yozuv; turli id — faqat bittasi yaratiladi", async () => {
    const u = await newUser();
    const o = await newOrder(u);
    const id = randomUUID();
    const same = await Promise.all(Array.from({ length: 5 }, () => create(id, o)));
    expect(new Set(same.map((r) => r.result.transaction)).size).toBe(1);
    const o2 = await newOrder(u, "PRO");
    const diff = await Promise.all(Array.from({ length: 5 }, () => create(randomUUID(), o2, 90_000_000)));
    expect(diff.filter((r) => r.result)).toHaveLength(1);
    expect(diff.filter((r) => r.error?.code === -31099)).toHaveLength(4);
  });

  it("12 soatdan oshgan takror — -31008 va bekor (reason 4)", async () => {
    const o = await newOrder(await newUser());
    const id = randomUUID();
    await create(id, o);
    await prisma.paymeTransaction.update({ where: { paymeId: id }, data: { createTime: BigInt(Date.now() - H12 - 1000) } });
    expect((await create(id, o)).error.code).toBe(-31008);
    expect((await rpc("CheckTransaction", { id })).result).toMatchObject({ state: -1, reason: 4, cancel_time: expect.any(Number) });
    expect((await order(o)).status).toBe("CANCELLED");
  });
});

describe("PerformTransaction", () => {
  it("to'laydi, obuna 14 kun, kirish ochiladi; takror va parallel — bir marta", async () => {
    const u = await newUser();
    expect((await http().get("/me").set(u.auth).expect(200)).body).toMatchObject({ access: false, subscription: null });
    const o = await newOrder(u);
    const id = randomUUID();
    await create(id, o);
    const all = await Promise.all(Array.from({ length: 5 }, () => rpc("PerformTransaction", { id })));
    for (const r of all) expect(r.result).toEqual(all[0].result);
    expect(all[0].result).toEqual({ transaction: expect.any(String), perform_time: expect.any(Number), state: 2 });
    expect((await until(u))!.getTime()).toBe(all[0].result.perform_time + 14 * DAY);
    expect(await prisma.subscription.count({ where: { userId: u.id } })).toBe(1);
    expect(await order(o)).toMatchObject({ status: "PAID", paidAt: new Date(all[0].result.perform_time) });
    expect((await http().get("/me").set(u.auth).expect(200)).body).toMatchObject({ access: true, subscription: { tariff: "STANDARD" } });
    // Bajarilgandan keyin takroriy Create — mavjud holat qaytmaydi.
    expect((await create(id, o)).error.code).toBe(-31008);
  });

  it("obuna uzaytiriladi (parallel ikki buyurtmada ham); muddat tugasa kirish yopiladi", async () => {
    const u = await newUser();
    const [o1, o2] = [await newOrder(u), await newOrder(u, "PRO")];
    const [a, b] = [randomUUID(), randomUUID()];
    await create(a, o1);
    await create(b, o2, 90_000_000);
    await Promise.all([rpc("PerformTransaction", { id: a }), rpc("PerformTransaction", { id: b })]);
    const left = (await until(u))!.getTime() - Date.now();
    expect(left).toBeGreaterThan(44 * DAY - 60_000);
    expect(left).toBeLessThanOrEqual(44 * DAY);
    await prisma.user.update({ where: { id: u.id }, data: { subscriptionUntil: new Date(Date.now() - 1) } });
    expect((await http().get("/me").set(u.auth)).body.access).toBe(false);
  });

  it("MAX 30 kun; topilmasa -31003; bekor qilingan -31008; timeout -31008 va bekor saqlanadi", async () => {
    const u = await newUser();
    const { performed } = await paid(u, "MAX", 150_000_000);
    expect((await until(u))!.getTime()).toBe(performed.perform_time + 30 * DAY);
    expect((await rpc("PerformTransaction", { id: "yoq" })).error.code).toBe(-31003);
    const o = await newOrder(u);
    const id = randomUUID();
    await create(id, o);
    await rpc("CancelTransaction", { id, reason: 3 });
    expect((await rpc("PerformTransaction", { id })).error.code).toBe(-31008);
    const o2 = await newOrder(u);
    const id2 = randomUUID();
    await create(id2, o2);
    await prisma.paymeTransaction.update({ where: { paymeId: id2 }, data: { createTime: BigInt(Date.now() - H12 - 1000) } });
    expect((await rpc("PerformTransaction", { id: id2 })).error.code).toBe(-31008);
    expect((await prisma.paymeTransaction.findUniqueOrThrow({ where: { paymeId: id2 } })).state).toBe(-1);
    expect((await order(o2)).status).toBe("CANCELLED");
  });
});

describe("CancelTransaction", () => {
  it("yaratilgan -> -1, takror o'sha natija; topilmasa -31003; reason noto'g'ri -32600", async () => {
    const o = await newOrder(await newUser());
    const id = randomUUID();
    await create(id, o);
    expect((await rpc("CancelTransaction", { id })).error.code).toBe(-32600);
    const first = (await rpc("CancelTransaction", { id, reason: 3 })).result;
    expect(first).toEqual({ transaction: expect.any(String), cancel_time: expect.any(Number), state: -1 });
    expect((await rpc("CancelTransaction", { id, reason: 5 })).result).toEqual(first);
    expect((await rpc("CheckTransaction", { id })).result.reason).toBe(3);
    expect((await order(o)).status).toBe("CANCELLED");
    expect((await create(randomUUID(), o)).error.code).toBe(-31099);
    expect((await rpc("CancelTransaction", { id: "yoq", reason: 1 })).error.code).toBe(-31003);
  });

  it("bajarilgan -> -2: faqat shu buyurtma obunasi olinadi", async () => {
    const u = await newUser();
    const first = await paid(u);
    const second = await paid(u, "PRO", 90_000_000);
    const c = (await rpc("CancelTransaction", { id: first.id, reason: 5 })).result;
    expect(c.state).toBe(-2);
    expect((await rpc("CancelTransaction", { id: first.id, reason: 5 })).result).toEqual(c);
    expect((await until(u))!.getTime()).toBe(second.performed.perform_time + 30 * DAY);
    await rpc("CancelTransaction", { id: second.id, reason: 5 });
    expect(await until(u)).toBeNull();
    expect((await http().get("/me").set(u.auth)).body).toMatchObject({ access: false, subscription: null });
    expect((await order(first.orderId)).status).toBe("CANCELLED");
    expect((await rpc("PerformTransaction", { id: first.id })).error.code).toBe(-31008);
  });

  it("qo'lda tasdiqlangan (muddatsiz) kirishga tegmaydi", async () => {
    const u = await newUser();
    const t = await paid(u);
    await prisma.user.update({ where: { id: u.id }, data: { paymentStatus: "PAID" } });
    await rpc("CancelTransaction", { id: t.id, reason: 5 });
    expect((await http().get("/me").set(u.auth)).body.access).toBe(true);
  });
});

describe("CheckTransaction va GetStatement", () => {
  it("holat qaytadi; topilmasa -31003", async () => {
    const t = await paid(await newUser());
    expect((await rpc("CheckTransaction", { id: t.id })).result).toEqual({ create_time: expect.any(Number), perform_time: t.performed.perform_time, cancel_time: 0, transaction: t.performed.transaction, state: 2, reason: null });
    expect((await rpc("CheckTransaction", { id: "yoq" })).error.code).toBe(-31003);
  });

  it("oraliq ikki chetini o'z ichiga oladi, vaqt bo'yicha tartiblangan; parametr xatosi -32600", async () => {
    const u = await newUser();
    const base = Date.now() - 3600_000;
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const orders = [await newOrder(u), await newOrder(u, "PRO"), await newOrder(u, "MAX")];
    const sums = [STANDARD, 90_000_000, 150_000_000];
    for (const i of [2, 0, 1]) await create(ids[i], orders[i], sums[i], base + i * 1000);
    const list = (await rpc("GetStatement", { from: base, to: base + 1000 })).result.transactions as { id: string }[];
    expect(list.map((t) => t.id).filter((id) => (ids as string[]).includes(id))).toEqual(ids.slice(0, 2));
    expect(list.find((t) => t.id === ids[0])).toMatchObject({ time: base, amount: STANDARD, account: account(orders[0]), state: 1, perform_time: 0, cancel_time: 0, reason: null });
    expect((await rpc("GetStatement", { from: 1, to: 2 })).result).toEqual({ transactions: [] });
    expect((await rpc("GetStatement", { from: "a", to: 2 })).error.code).toBe(-32600);
  });
});

describe("create-order va order/:id", () => {
  it("serverdagi narx va Payme havolasi; klient narxi rad etiladi", async () => {
    const u = await newUser();
    const res = (await http().post("/payments/create-order").set(u.auth).send({ tariff: "PRO" }).expect(201)).body;
    expect(res).toMatchObject({ tariff: "PRO", amount: 90_000_000, status: "PENDING" });
    expect(res.checkoutUrl).toMatch(/^https:\/\/test\.paycom\.uz\//);
    expect(Buffer.from(res.checkoutUrl.replace("https://test.paycom.uz/", ""), "base64").toString()).toBe(
      `m=e2e-merchant;ac.order_id=${res.id};a=90000000;l=uz;c=https://www.pravaishonch.uz/kabinet/tolov-natija?order=${res.id}`,
    );
    expect(await newOrder(u, "PRO")).toBe(res.id);
    process.env.PAYME_ENV = "prod";
    expect((await http().post("/payments/create-order").set(u.auth).send({ tariff: "MAX" })).body.checkoutUrl).toMatch(/^https:\/\/checkout\.paycom\.uz\//);
    await http().post("/payments/create-order").set(u.auth).send({ tariff: "PRO", amount: 1 }).expect(400);
    await http().post("/payments/create-order").set(u.auth).send({ tariff: "GOLD" }).expect(400);
    await http().post("/payments/create-order").send({ tariff: "PRO" }).expect(401);
  });

  it("flag o'chiq — 503; sozlanmagan — 503; boshlangan to'lov webhook'i ishlayveradi", async () => {
    const u = await newUser();
    const o = await newOrder(u);
    process.env.PAYMENTS_ENABLED = "false";
    expect((await http().post("/payments/create-order").set(u.auth).send({ tariff: "PRO" }).expect(503)).body.code).toBe("PAYMENTS_DISABLED");
    expect((await http().get("/payments/tariffs").expect(200)).body.enabled).toBe(false);
    expect((await create(randomUUID(), o)).result.state).toBe(1);
    process.env.PAYMENTS_ENABLED = "true";
    process.env.PAYME_MERCHANT_ID = "";
    await http().post("/payments/create-order").set(u.auth).send({ tariff: "PRO" }).expect(503);
  });

  it("production'da sandbox — faqat PAYME_TEST_USERS", async () => {
    const u = await newUser();
    process.env.VERCEL_ENV = "production";
    await http().post("/payments/create-order").set(u.auth).send({ tariff: "PRO" }).expect(503);
    process.env.PAYME_TEST_USERS = `x, ${u.id}`;
    await http().post("/payments/create-order").set(u.auth).send({ tariff: "PRO" }).expect(201);
    expect((await http().get("/payments/tariffs").expect(200)).body.enabled).toBe(false);
    expect((await http().get("/payments/tariffs").set(u.auth).expect(200)).body).toMatchObject({ enabled: true, tariffs: [{ id: "STANDARD", price: 300000, durationDays: 14 }, { id: "PRO", price: 900000, durationDays: 30 }, { id: "MAX", price: 1500000, durationDays: 30 }] });
  });

  it("ro'yxatdan o'tmagan, markaz o'quvchisi, muddatsiz to'lagan — rad", async () => {
    const post = async (data: Record<string, unknown>) => (await http().post("/payments/create-order").set((await newUser(data)).auth).send({ tariff: "PRO" })).body.code;
    expect(await post({ registeredAt: null })).toBe("NOT_REGISTERED");
    expect(await post({ paymentStatus: "PAID" })).toBe("ALREADY_PAID");
    const center = await newUser();
    const session = await prisma.session.findFirstOrThrow({ where: { userId: center.id } });
    await prisma.user.update({ where: { id: center.id }, data: { type: "CENTER", activeSessionId: session.id } });
    expect((await http().post("/payments/create-order").set(center.auth).send({ tariff: "PRO" })).body.code).toBe("CENTER_ACCOUNT");
  });

  it("holatni faqat egasi ko'radi; timeout holatda ko'rinadi", async () => {
    const u = await newUser();
    const o = await newOrder(u);
    await http().get(`/payments/order/${o}`).expect(401);
    await http().get(`/payments/order/${o}`).set((await newUser()).auth).expect(404);
    await http().get("/payments/order/abc").set(u.auth).expect(400);
    const id = randomUUID();
    await create(id, o);
    expect((await http().get(`/payments/order/${o}`).set(u.auth).expect(200)).body.status).toBe("PENDING");
    await prisma.paymeTransaction.update({ where: { paymeId: id }, data: { createTime: BigInt(Date.now() - H12 - 1000) } });
    expect((await http().get(`/payments/order/${o}`).set(u.auth).expect(200)).body.status).toBe("CANCELLED");
  });
});
