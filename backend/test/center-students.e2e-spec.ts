import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService, hashToken } from "../src/auth/auth.service";
import { generateLogin, generatePassword } from "../src/auth/center-credentials";
import { normalizePhone } from "../src/common/phone";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// Markaz o'quvchilari: admin yaratadi → "Men shu yerda o'qiyman" orqali kiradi →
// bir vaqtda faqat bitta faol qurilma.
const ADMIN = "e2e-centeradmin";
const PASSWORD = "Center-Admin-Pass-77";
const PHONE_PREFIX = "+99877000";
const LESSON = "day1-topic1";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; SM-A146) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
let phoneSeq = 0;

function http() {
  return request(app.getHttpServer());
}

function nextPhone(): string {
  phoneSeq += 1;
  return `${PHONE_PREFIX}${String(phoneSeq).padStart(4, "0")}`;
}

interface Credentials {
  id: string;
  name: string | null;
  phone: string;
  login: string;
  password: string;
}

async function createStudent(body: Record<string, unknown> = {}): Promise<Credentials> {
  const res = await http().post("/admin/students").set(admin).send({ phone: nextPhone(), ...body }).expect(201);
  return res.body as Credentials;
}

async function login(c: Pick<Credentials, "phone" | "login" | "password">, ua = ANDROID_UA) {
  return http().post("/auth/center/login").set("User-Agent", ua).send({ phone: c.phone, login: c.login, password: c.password });
}

async function loginToken(c: Credentials, ua = ANDROID_UA): Promise<{ Authorization: string }> {
  const res = await login(c, ua);
  expect(res.status).toBe(200);
  return { Authorization: `Bearer ${(res.body as { token: string }).token}` };
}

beforeAll(async () => {
  await configureAdminEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await prisma.user.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.30.0.1");
});

beforeEach(async () => {
  await prisma.userLoginAttempt.deleteMany({});
});

afterAll(async () => {
  process.env.PAYMENT_ENFORCED = "false";
  await prisma.user.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
  await prisma.userLoginAttempt.deleteMany({});
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  await app.close();
});

describe("yordamchi funksiyalar", () => {
  it("telefonni +998XXXXXXXXX ko'rinishiga keltiradi", () => {
    for (const raw of ["+998 90 123 45 67", "998901234567", "901234567", "90 123-45-67", "+998 (90) 123-45-67", " +998901234567 "]) {
      expect(normalizePhone(raw)).toBe("+998901234567");
    }
    for (const raw of ["12345", "+7 901 234 56 78", "9012345678", ""]) {
      expect(normalizePhone(raw)).toBeNull();
    }
  });

  it("login va parol formati", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateLogin()).toMatch(/^pt\d{5}$/);
      const password = generatePassword();
      expect(password).toHaveLength(8);
      expect(password).not.toMatch(/[0O1lIio]/);
    }
  });
});

describe("admin: o'quvchi qo'shish", () => {
  it("login va parolni avtomatik yaratadi, parol ro'yxatda qaytmaydi", async () => {
    const created = await createStudent({ name: "Ali Valiyev" });
    expect(created.login).toMatch(/^pt\d{5}$/);
    expect(created.password).toHaveLength(8);
    expect(created.name).toBe("Ali Valiyev");

    const row = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.type).toBe("CENTER");
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.passwordHash).not.toContain(created.password);
    expect(row.registeredAt).not.toBeNull();

    const list = await http().get(`/admin/students?q=${created.login}`).set(admin).expect(200);
    const text = JSON.stringify(list.body);
    expect(text).toContain(created.login);
    expect(text).not.toContain(created.password);
    expect(text).not.toContain("passwordHash");
    expect(text).not.toContain("argon2");

    const detail = await http().get(`/admin/users/${created.id}`).set(admin).expect(200);
    expect(JSON.stringify(detail.body)).not.toContain(created.password);
    expect(JSON.stringify(detail.body)).not.toContain("argon2");
    expect((detail.body as { type: string }).type).toBe("CENTER");

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "student.created", entityId: created.id } });
    expect(JSON.stringify(audit)).not.toContain(created.password);
  });

  it("qo'lda login va parol; takroriy telefon (boshqa formatda) va login rad etiladi", async () => {
    const phone = nextPhone();
    const local = phone.replace("+998", "");
    const created = await createStudent({ phone: `${local.slice(0, 2)} ${local.slice(2, 5)}-${local.slice(5, 7)}-${local.slice(7)}`, login: "E2E.Student", password: "manual-pass" });
    expect(created.phone).toBe(phone);
    expect(created.login).toBe("e2e.student");
    expect(created.password).toBe("manual-pass");

    const dupPhone = await http().post("/admin/students").set(admin).send({ phone: `998${local}` }).expect(409);
    expect(dupPhone.body.code).toBe("PHONE_TAKEN");
    const dupLogin = await http().post("/admin/students").set(admin).send({ phone: nextPhone(), login: "e2e.student" }).expect(409);
    expect(dupLogin.body.code).toBe("LOGIN_TAKEN");
    await http().post("/admin/students").set(admin).send({ phone: "12345" }).expect(400);
    await http().post("/admin/students").set(admin).send({ phone: nextPhone(), password: "123" }).expect(400);
    await http().post("/admin/students").set(admin).send({ phone: nextPhone(), login: "Bad Login!" }).expect(400);
  });

  it("ommaviy qo'shish: har bir qator alohida natija", async () => {
    const a = nextPhone();
    const b = nextPhone();
    const res = await http()
      .post("/admin/students/bulk")
      .set(admin)
      .send({ phones: [a, "", b.replace("+998", ""), "noto'g'ri", a] })
      .expect(201);
    const body = res.body as { created: Credentials[]; errors: { line: number; message: string }[] };
    expect(body.created.map((c) => c.phone)).toEqual([a, b]);
    expect(body.created.every((c) => /^pt\d{5}$/.test(c.login) && c.password.length === 8)).toBe(true);
    expect(body.errors.map((e) => e.line)).toEqual([4, 5]);
  });

  it("oddiy foydalanuvchi tokeni bilan admin endpointlari yopiq", async () => {
    const { token } = await app.get(AuthService).createAnonymousSession();
    await http().get("/admin/students").set({ Authorization: `Bearer ${token}` }).expect(403);
    await http().post("/admin/students").set({ Authorization: `Bearer ${token}` }).send({ phone: nextPhone() }).expect(403);
  });

  it("o'quvchilar ro'yxati va yangi foydalanuvchilar ro'yxati aralashmaydi", async () => {
    const created = await createStudent();
    const self = await http().get(`/admin/users?q=${created.phone.slice(-7)}`).set(admin).expect(200);
    expect((self.body as { items: { id: string }[] }).items.some((u) => u.id === created.id)).toBe(false);
  });
});

describe("kirish (telefon + login + parol)", () => {
  it("muvaffaqiyatli kirish: /me CENTER, to'lovsiz to'liq kirish, qurilma yoziladi", async () => {
    process.env.PAYMENT_ENFORCED = "true";
    try {
      const c = await createStudent({ name: "Kirish Testi" });
      const auth = await loginToken({ ...c, phone: c.phone.replace("+998", "") }, IPHONE_UA);
      const me = await http().get("/me").set(auth).expect(200);
      expect(me.body).toMatchObject({ registered: true, access: true, type: "CENTER", paymentRequired: false });
      expect(me.body.profile.firstName).toBe("Kirish");
      await http().get(`/lessons/${LESSON}/video`).set(auth).expect(200);
      const row = await prisma.user.findUniqueOrThrow({ where: { id: c.id } });
      expect(row.lastDevice).toBe("iPhone · Safari");
      expect(row.lastLoginAt).not.toBeNull();
    } finally {
      process.env.PAYMENT_ENFORCED = "false";
    }
  });

  it("xato telefon, login yoki parol — bir xil umumiy xabar", async () => {
    const c = await createStudent();
    const other = await createStudent();
    const cases = [
      { ...c, password: "notogri1" },
      { ...c, phone: other.phone },
      { ...c, login: "pt-yoq-login" },
      { ...c, phone: "123" },
    ];
    for (const attempt of cases) {
      const res = await login(attempt);
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ code: "INVALID_CREDENTIALS", message: "Telefon, login yoki parol noto'g'ri" });
    }
  });

  it("5 ta xato urinishdan keyin login bloklanadi (to'g'ri parol ham o'tmaydi)", async () => {
    const c = await createStudent();
    for (let i = 0; i < 5; i++) expect((await login({ ...c, password: `xato-${i}-parol` })).status).toBe(401);
    const blocked = await login(c);
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("LOGIN_RATE_LIMITED");
    // Boshqa o'quvchi (shu IP'dan) kira oladi — IP chegarasi kattaroq.
    const other = await createStudent();
    expect((await login(other)).status).toBe(200);
  });

  it("faolsiz akkaunt kira olmaydi, eski tokeni 401 ACCOUNT_INACTIVE; faollashtirilgach kiradi", async () => {
    const c = await createStudent();
    const auth = await loginToken(c);
    await http().post(`/admin/students/${c.id}/deactivate`).set(admin).expect(204);
    const old = await http().get("/me").set(auth).expect(401);
    expect(old.body.code).toBe("ACCOUNT_INACTIVE");
    const res = await login(c);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "ACCOUNT_INACTIVE", message: "Akkaunt faol emas, markazga murojaat qiling" });
    await http().post(`/admin/students/${c.id}/activate`).set(admin).expect(204);
    // Faolsizlantirish faol sessiyani ham bekor qilgan.
    expect((await http().get("/me").set(auth).expect(401)).body.code).toBe("SESSION_REVOKED");
    await loginToken(c);
  });

  it("to'liq kirish o'chirilsa — kontent yopiq (to'lov shartidan qat'i nazar)", async () => {
    const c = await createStudent();
    const auth = await loginToken(c);
    await http().patch(`/admin/students/${c.id}`).set(admin).send({ centerAccess: false }).expect(200);
    const res = await http().get(`/lessons/${LESSON}/video`).set(auth).expect(403);
    expect(res.body.code).toBe("CENTER_ACCESS_DISABLED");
    expect((await http().get("/me").set(auth).expect(200)).body.access).toBe(false);
    await http().patch(`/admin/students/${c.id}`).set(admin).send({ centerAccess: true }).expect(200);
    await http().get(`/lessons/${LESSON}/video`).set(auth).expect(200);
  });
});

describe("yagona faol qurilma", () => {
  it("2-qurilmadan kirilsa 1-qurilma 401 SESSION_REPLACED, progress saqlanadi", async () => {
    const c = await createStudent();
    const first = await loginToken(c, ANDROID_UA);
    await http().post(`/lessons/${LESSON}/progress`).set(first).send({ position: 20, maxPosition: 20, watchedDelta: 20 }).expect(200);
    const before = await http().get(`/lessons/${LESSON}`).set(first).expect(200);

    const second = await loginToken(c, IPHONE_UA);
    const replaced = await http().get("/me").set(first).expect(401);
    expect(replaced.body.code).toBe("SESSION_REPLACED");
    expect((await http().get("/auth/check").set(first)).status).toBe(401);
    expect((await http().get("/auth/check").set(second)).status).toBe(204);

    // Eski qurilmadan yuborilgan progress rad etiladi va hech narsani o'zgartirmaydi.
    const late = await http().post(`/lessons/${LESSON}/progress`).set(first).send({ position: 40, maxPosition: 40, watchedDelta: 20 });
    expect(late.status).toBe(401);
    const after = await http().get(`/lessons/${LESSON}`).set(second).expect(200);
    expect(after.body.maxPosition).toBe(before.body.maxPosition);
    expect(after.body.watchedSeconds).toBe(before.body.watchedSeconds);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: c.id } })).lastDevice).toBe("iPhone · Safari");
  });

  it("bir vaqtdagi ikki kirish: oxirida faqat bitta sessiya faol", async () => {
    const c = await createStudent();
    for (let round = 0; round < 3; round++) {
      const results = await Promise.all([login(c, ANDROID_UA), login(c, IPHONE_UA)]);
      const tokens = results.filter((r) => r.status === 200).map((r) => (r.body as { token: string }).token);
      expect(tokens.length).toBeGreaterThanOrEqual(1);
      const checks = await Promise.all(tokens.map((t) => http().get("/auth/check").set({ Authorization: `Bearer ${t}` })));
      expect(checks.filter((r) => r.status === 204)).toHaveLength(1);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: c.id } });
      const active = await prisma.session.findUniqueOrThrow({ where: { id: user.activeSessionId! } });
      expect(tokens.map(hashToken)).toContain(active.tokenHash);
    }
  });

  it("'Qurilmadan chiqarish' sessiyani bekor qiladi", async () => {
    const c = await createStudent();
    const auth = await loginToken(c);
    await http().post(`/admin/students/${c.id}/logout`).set(admin).expect(204);
    expect((await http().get("/me").set(auth).expect(401)).body.code).toBe("SESSION_REVOKED");
    await loginToken(c);
  });

  it("parol reset: eski sessiya va eski parol ishlamaydi, yangi parol bir marta qaytadi", async () => {
    const c = await createStudent();
    const auth = await loginToken(c);
    const reset = await http().post(`/admin/students/${c.id}/reset-password`).set(admin).send({}).expect(200);
    const fresh = reset.body as Credentials;
    expect(fresh.login).toBe(c.login);
    expect(fresh.password).toHaveLength(8);
    expect(fresh.password).not.toBe(c.password);
    expect((await http().get("/me").set(auth).expect(401)).body.code).toBe("SESSION_REVOKED");
    expect((await login(c)).status).toBe(401);
    await loginToken(fresh);
    const list = await http().get(`/admin/students?q=${c.login}`).set(admin).expect(200);
    expect(JSON.stringify(list.body)).not.toContain(fresh.password);
  });

  it("o'chirilgan o'quvchining tokeni 401", async () => {
    const c = await createStudent();
    const auth = await loginToken(c);
    await http().delete(`/admin/students/${c.id}`).set(admin).expect(204);
    expect(await prisma.user.findUnique({ where: { id: c.id } })).toBeNull();
    expect((await http().get("/me").set(auth).expect(401)).body.code).toBe("SESSION_INVALID");
    expect((await login(c)).status).toBe(401);
  });

  it("SELF foydalanuvchi va admin sessiyalariga ta'sir qilmaydi", async () => {
    const auth = app.get(AuthService);
    const { token } = await auth.createAnonymousSession();
    const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
    // Bitta SELF foydalanuvchining ikkinchi qurilmasi — ikkalasi ham ishlaydi.
    const secondToken = "e2e-self-second-device-token-0123456789";
    await prisma.session.create({ data: { userId: session.userId, tokenHash: hashToken(secondToken), expiresAt: new Date(Date.now() + 86_400_000) } });

    const c = await createStudent();
    await loginToken(c);
    await loginToken(c);

    await http().get("/me").set({ Authorization: `Bearer ${token}` }).expect(200);
    await http().get("/me").set({ Authorization: `Bearer ${secondToken}` }).expect(200);
    await http().get("/auth/check").set({ Authorization: `Bearer ${token}` }).expect(204);
    await http().get("/admin/students").set(admin).expect(200);
    await prisma.user.delete({ where: { id: session.userId } });
  });
});

describe("har bir kunning 1-mavzusi ochiq", () => {
  it("yangi foydalanuvchi oldingi kunlarsiz istalgan kunning 1-mavzu videosini ocha oladi", async () => {
    const c = await createStudent();
    const auth = await loginToken(c);
    for (let day = 1; day <= 6; day++) {
      const id = `day${day}-topic1`;
      const video = await http().get(`/lessons/${id}/video`).set(auth).expect(200);
      expect(video.body.videoId).toMatch(/^[A-Za-z0-9_-]{11}$/);
      await http().post(`/lessons/${id}/progress`).set(auth).send({ position: 5, maxPosition: 5, watchedDelta: 5 }).expect(200);
    }
  });

  it("mavzu testi o'z videosi ko'rilmaguncha yopiq qoladi (eski qoida)", async () => {
    const c = await createStudent();
    const auth = await loginToken(c);
    const res = await http().get("/topics/day3-topic1/questions").set(auth).expect(403);
    expect(res.body.code).toBe("LESSON_NOT_COMPLETED");
  });
});
