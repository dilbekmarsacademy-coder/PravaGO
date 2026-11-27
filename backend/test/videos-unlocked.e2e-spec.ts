import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// Admin alohida o'quvchiga barcha videodarslarni ochadi (User.videosUnlocked).
const LESSON = "day1-topic1";
const ADMIN = "e2e-videounlock";
const PASSWORD = "Video-Unlock-77";

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
const userIds: string[] = [];
const http = () => request(app.getHttpServer());

async function newUser(data: Record<string, unknown> = {}) {
  const { token } = await app.get(AuthService).createAnonymousSession("e2e");
  const auth = { Authorization: `Bearer ${token}` };
  const { user } = (await app.get(AuthService).resolveToken(token)) as { user: { id: string } };
  userIds.push(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { registeredAt: new Date(), firstName: "Video", ...data } });
  return { id: user.id, auth };
}
type U = Awaited<ReturnType<typeof newUser>>;
const standart = () => newUser({ subscriptionUntil: new Date(Date.now() + 86_400_000), subscriptionTariff: "STANDART_7" });
const video = (u: U) => http().get(`/lessons/${LESSON}/video`).set(u.auth);
const toggle = (id: string, enabled: boolean, headers = admin) => http().post(`/admin/users/${id}/videos-unlocked`).set(headers).send({ enabled });

beforeAll(async () => {
  process.env.PAYMENT_ENFORCED = "true";
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
  await prisma.topic.upsert({ where: { slug: LESSON }, update: {}, create: { slug: LESSON, title: LESSON } });
  await configureAdminEnv();
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.22.0.1");
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  process.env.PAYMENT_ENFORCED = "false";
  await app.close();
});

describe("admin: barcha videolarni ochish", () => {
  it("Standart o'quvchi: yoqilsa video ochiladi va test odatiy shartga qaytadi; o'chirilsa yana yopiladi", async () => {
    const u = await standart();
    expect((await video(u).expect(403)).body.code).toBe("VIDEO_NOT_INCLUDED");
    expect((await http().get("/me").set(u.auth).expect(200)).body).toMatchObject({ videoAccess: false, videosUnlocked: false });

    expect((await toggle(u.id, true).expect(200)).body).toEqual({ id: u.id, videosUnlocked: true });
    await video(u).expect(200);
    expect((await http().get("/me").set(u.auth).expect(200)).body).toMatchObject({ access: true, videoAccess: true, videosUnlocked: true, unlockAll: false });
    // Test o'z sharti bilan: video ko'rilmaguncha yopiq (Standartdagi "videosiz test" endi qo'llanmaydi).
    expect((await http().get(`/topics/${LESSON}/questions`).set(u.auth).expect(403)).body.code).toBe("LESSON_NOT_COMPLETED");
    expect((await http().get(`/admin/users/${u.id}`).set(admin).expect(200)).body.videosUnlocked).toBe(true);

    expect((await toggle(u.id, false).expect(200)).body).toEqual({ id: u.id, videosUnlocked: false });
    expect((await video(u).expect(403)).body.code).toBe("VIDEO_NOT_INCLUDED");

    const audit = await prisma.auditLog.findMany({ where: { action: "user.videos_unlocked", entityId: u.id }, orderBy: { createdAt: "asc" } });
    expect(audit.map((a) => (a.after as { videosUnlocked: boolean }).videosUnlocked)).toEqual([true, false]);
  });

  it("faqat shu foydalanuvchiga: boshqa Standart o'quvchi o'zgarmaydi", async () => {
    const [a, b] = [await standart(), await standart()];
    await toggle(a.id, true).expect(200);
    await video(a).expect(200);
    expect((await video(b).expect(403)).body.code).toBe("VIDEO_NOT_INCLUDED");
  });

  it("to'lovsiz o'quvchiga kurs kirishini bermaydi", async () => {
    const u = await newUser();
    await toggle(u.id, true).expect(200);
    expect((await video(u).expect(403)).body.code).toBe("PAYMENT_REQUIRED");
    expect((await http().get("/me").set(u.auth).expect(200)).body).toMatchObject({ access: false, videoAccess: false });
  });

  it("admin sessiyasisiz 403; noto'g'ri tana 400; noma'lum foydalanuvchi 404", async () => {
    const u = await standart();
    await http().post(`/admin/users/${u.id}/videos-unlocked`).send({ enabled: true }).expect(403);
    await toggle(u.id, "ha" as unknown as boolean).expect(400);
    await http().post(`/admin/users/${u.id}/videos-unlocked`).set(admin).send({ enabled: true, extra: 1 }).expect(400);
    await toggle("00000000-0000-4000-8000-000000000000", true).expect(404);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).videosUnlocked).toBe(false);
  });
});
