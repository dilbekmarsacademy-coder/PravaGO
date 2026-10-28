import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// Ro'yxatdan o'tish → to'lov so'rovi → admin tasdiqlaydi → kurs ochiladi.
const TOPIC = "e2e-pay-topic";
const ADMIN = "e2e-payadmin";
const PASSWORD = "Payments-Admin-77";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
let questionId: string;
let optionId: string;

function http() {
  return request(app.getHttpServer());
}

async function newUser(): Promise<{ Authorization: string }> {
  const { token } = await app.get(AuthService).createAnonymousSession("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile Safari/604.1");
  return { Authorization: `Bearer ${token}` };
}

const profile = { firstName: "Test", lastName: "Foydalanuvchi", age: 25, examStatus: "first-time" };

beforeAll(async () => {
  await configureAdminEnv();
  process.env.PAYMENT_ENFORCED = "true";
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await prisma.user.deleteMany({ where: { phone: { startsWith: "+99890000" } } });
  await prisma.topic.deleteMany({ where: { slug: TOPIC } });
  const topic = await prisma.topic.create({ data: { slug: TOPIC, title: TOPIC } });
  const q = await prisma.question.create({
    data: {
      topicId: topic.id,
      order: 1,
      text: "Савол",
      keyword: "",
      options: { create: [{ order: 1, text: "А", isCorrect: true }, { order: 2, text: "Б" }] },
    },
    include: { options: true },
  });
  questionId = q.id;
  optionId = q.options[0].id;
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.20.0.1");
});

afterAll(async () => {
  process.env.PAYMENT_ENFORCED = "false";
  await prisma.user.deleteMany({ where: { phone: { startsWith: "+99890000" } } });
  await prisma.topic.deleteMany({ where: { slug: TOPIC } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  await app.close();
});

describe("ro'yxatdan o'tish", () => {
  it("telefonni normallashtiradi, /me'da telefon qaytmaydi", async () => {
    const auth = await newUser();
    const before = await http().get("/me").set(auth).expect(200);
    expect(before.body).toMatchObject({ registered: false, access: false, paymentRequired: true });
    const res = await http().post("/me/register").set(auth).send({ ...profile, phone: "+998 90 000 00 01" }).expect(200);
    expect(res.body).toMatchObject({ registered: true, profile: { firstName: "Test" }, payment: { status: "NONE", amount: 350000 } });
    expect(JSON.stringify(res.body)).not.toContain("000 00 01");
    expect(JSON.stringify(res.body)).not.toContain("900000001");
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: "+998900000001" } });
    expect(user.registeredAt).not.toBeNull();
  });

  it("validatsiya: noto'g'ri telefon, yosh va ortiqcha maydon", async () => {
    const auth = await newUser();
    await http().post("/me/register").set(auth).send({ ...profile, phone: "12345" }).expect(400);
    await http().post("/me/register").set(auth).send({ ...profile, age: 10, phone: "900000009" }).expect(400);
    await http().post("/me/register").set(auth).send({ ...profile, phone: "900000009", userId: "x" }).expect(400);
  });

  it("boshqa akkauntdagi raqam — 409 PHONE_TAKEN", async () => {
    const auth = await newUser();
    const res = await http().post("/me/register").set(auth).send({ ...profile, phone: "900000001" }).expect(409);
    expect((res.body as { code: string }).code).toBe("PHONE_TAKEN");
  });

  it("eski (localStorage) faol ro'yxat — kutilayotgan to'lov so'rovi bilan ko'chiriladi", async () => {
    const auth = await newUser();
    const res = await http().post("/me/register").set(auth).send({ ...profile, phone: "900000002", legacyStatus: "active" }).expect(200);
    expect(res.body).toMatchObject({ payment: { status: "PENDING" }, access: false });
  });
});

describe("to'lov va kirish huquqi", () => {
  it("to'lovsiz — test 403 PAYMENT_REQUIRED; tasdiqlangach ochiladi; bekor qilinsa yopiladi", async () => {
    const auth = await newUser();
    await http().post("/me/register").set(auth).send({ ...profile, phone: "900000003" }).expect(200);

    const locked = await http().get(`/topics/${TOPIC}/questions`).set(auth).expect(403);
    expect((locked.body as { code: string }).code).toBe("PAYMENT_REQUIRED");
    await http().post(`/questions/${questionId}/check-answer`).set(auth).send({ optionId }).expect(403);

    const requested = await http().post("/payments/request").set(auth).send({ note: "Kartadan o'tkazdim" }).expect(200);
    expect(requested.body).toMatchObject({ status: "PENDING", amount: 350000 });
    // Takroriy so'rov yangi yozuv yaratmaydi.
    await http().post("/payments/request").set(auth).send({}).expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: "+998900000003" } });
    expect(await prisma.payment.count({ where: { userId: user.id } })).toBe(1);

    // Oddiy foydalanuvchi admin API'ni ocha olmaydi.
    await http().get("/admin/payments").set(auth).expect(403);
    await http().post(`/admin/payments/${(requested.body as { id: string }).id}/confirm`).set(auth).send({}).expect(403);

    const list = await http().get("/admin/payments?status=PENDING").set(admin).expect(200);
    const row = (list.body as { items: { id: string; user: { phone: string } }[] }).items.find((p) => p.id === (requested.body as { id: string }).id);
    expect(row?.user.phone).toBe("+998900000003");

    await http().post(`/admin/payments/${row!.id}/confirm`).set(admin).send({ note: "Click orqali" }).expect(200);
    expect((await http().get("/me").set(auth).expect(200)).body).toMatchObject({ access: true, payment: { status: "PAID" } });
    const open = await http().get(`/topics/${TOPIC}/questions`).set(auth).expect(200);
    expect(JSON.stringify(open.body)).not.toContain("isCorrect");
    await http().post(`/questions/${questionId}/check-answer`).set(auth).send({ optionId }).expect(200);
    expect(await prisma.answerLog.count({ where: { userId: user.id, questionId } })).toBe(1);

    await http().post(`/admin/payments/${row!.id}/cancel`).set(admin).send({}).expect(200);
    await http().get(`/topics/${TOPIC}/questions`).set(auth).expect(403);

    const audit = await prisma.auditLog.findMany({ where: { entityId: row!.id }, orderBy: { createdAt: "asc" } });
    expect(audit.map((a) => a.action)).toEqual(["payment.confirmed", "payment.cancelled"]);
  });

  it("admin qo'lda tasdiqlangan to'lov qo'shadi; foydalanuvchilar ro'yxati va kartasi", async () => {
    const auth = await newUser();
    await http().post("/me/register").set(auth).send({ ...profile, firstName: "Qoʻlda", phone: "900000004" }).expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: "+998900000004" } });
    await http().post("/admin/payments").set(admin).send({ userId: user.id, status: "CONFIRMED", note: "Naqd" }).expect(201);
    expect((await http().get("/me").set(auth).expect(200)).body).toMatchObject({ access: true });

    const list = await http().get("/admin/users?q=900000004").set(admin).expect(200);
    expect((list.body as { total: number }).total).toBe(1);
    const paid = await http().get("/admin/users?payment=paid&q=Qo").set(admin).expect(200);
    expect((paid.body as { items: { id: string }[] }).items.map((u) => u.id)).toContain(user.id);

    const detail = await http().get(`/admin/users/${user.id}`).set(admin).expect(200);
    expect(detail.body).toMatchObject({ phone: "+998900000004", paymentStatus: "PAID" });
    expect((detail.body as { devices: { type: string }[] }).devices[0].type).toBe("mobile");

    const csv = await http().get("/admin/users/export.csv?q=900000004").set(admin).expect(200);
    expect(csv.text).toContain("+998900000004");
    await http().get("/admin/users/export.csv").expect(403);
  });

  it("admin foydalanuvchini o'chiradi — sessiyasi, to'lovlari ham ketadi", async () => {
    const auth = await newUser();
    await http().post("/me/register").set(auth).send({ ...profile, phone: "900000005" }).expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: "+998900000005" } });
    await http().post("/admin/payments").set(admin).send({ userId: user.id, status: "CONFIRMED" }).expect(201);

    await http().delete(`/admin/users/${user.id}`).expect(403);
    await http().delete(`/admin/users/${user.id}`).set(admin).expect(204);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.payment.count({ where: { userId: user.id } })).toBe(0);
    await http().get(`/admin/users/${user.id}`).set(admin).expect(404);
    await http().delete(`/admin/users/${user.id}`).set(admin).expect(404);
    expect((await http().get("/admin/users?q=900000005").set(admin).expect(200)).body.total).toBe(0);

    // Eski token endi ishlamaydi — qurilma yangi anonim sessiya ochadi.
    await http().get("/me").set(auth).expect(401);
    // Telefon bo'shadi — qayta ro'yxatdan o'tish mumkin.
    await http().post("/me/register").set(await newUser()).send({ ...profile, phone: "900000005" }).expect(200);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: user.id, action: "user.deleted" } });
    expect(audit.before).toMatchObject({ phone: "+998900000005" });
  });
});
