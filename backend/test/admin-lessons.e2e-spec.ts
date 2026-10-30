import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { parseYoutubeId } from "../src/admin/content/lesson-editor.service";
import { LESSONS, type LessonConfig } from "../src/lessons/lessons.config";
import { adminHeaders, configureAdminEnv, createTestAdmin } from "./helpers/admin";

// Admin panelda mavzu videosini almashtirish: foydalanuvchi API'si darhol
// yangi videoni beradi, "asl holatga qaytarish" kod (LESSONS) qiymatiga qaytaradi.
const SLUG = "day1-topic98";
const NO_VIDEO_SLUG = "day1-topic97";
const DEFAULT: LessonConfig = { videoId: "AAAAAAAAAAA", durationSec: 600 };
const ADMIN = "e2e-lessons";
const PASSWORD = "Lessons-Admin-123";
const LESSON_MAP = LESSONS as Record<string, LessonConfig>;

let app: INestApplication;
let prisma: PrismaService;
let admin: Record<string, string>;
let user: { Authorization: string };

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
  LESSON_MAP[SLUG] = DEFAULT;
  await prisma.lessonVideo.deleteMany({ where: { lessonId: SLUG } });
  await prisma.auditLog.deleteMany({ where: { entityType: "lesson", entityId: SLUG } });
  await prisma.topic.deleteMany({ where: { slug: { in: [SLUG, NO_VIDEO_SLUG] } } });
  await prisma.topic.createMany({ data: [{ slug: SLUG, title: SLUG }, { slug: NO_VIDEO_SLUG, title: NO_VIDEO_SLUG }] });
  await createTestAdmin(prisma, ADMIN, PASSWORD);
  admin = await adminHeaders(app, ADMIN, PASSWORD, "10.31.0.1");
  const { token } = await app.get(AuthService).createAnonymousSession();
  user = { Authorization: `Bearer ${token}` };
});

afterAll(async () => {
  delete LESSON_MAP[SLUG];
  await prisma.lessonVideo.deleteMany({ where: { lessonId: SLUG } });
  await prisma.auditLog.deleteMany({ where: { entityType: "lesson", entityId: SLUG } });
  await prisma.topic.deleteMany({ where: { slug: { in: [SLUG, NO_VIDEO_SLUG] } } });
  await prisma.admin.deleteMany({ where: { login: ADMIN } });
  await app.close();
});

describe("admin: mavzu videosi", () => {
  it("YouTube havolalaridan ID ajratiladi", () => {
    expect(parseYoutubeId("kBcw--eJ1AQ")).toBe("kBcw--eJ1AQ");
    expect(parseYoutubeId("https://youtu.be/kBcw--eJ1AQ?si=abc")).toBe("kBcw--eJ1AQ");
    expect(parseYoutubeId("https://www.youtube.com/watch?v=kBcw--eJ1AQ&t=10s")).toBe("kBcw--eJ1AQ");
    expect(parseYoutubeId("youtube.com/shorts/kBcw--eJ1AQ")).toBe("kBcw--eJ1AQ");
    expect(parseYoutubeId("https://www.youtube.com/embed/kBcw--eJ1AQ")).toBe("kBcw--eJ1AQ");
    expect(parseYoutubeId("https://example.com/watch?v=kBcw--eJ1AQ")).toBeNull();
    expect(parseYoutubeId("qisqa")).toBeNull();
  });

  it("oddiy foydalanuvchi admin video API'siga kira olmaydi", async () => {
    await http().get(`/admin/content/topics/${SLUG}/lesson`).set(user).expect(403);
    await http().put(`/admin/content/topics/${SLUG}/lesson`).set(user).send({ video: "BBBBBBBBBBB", durationSec: 60 }).expect(403);
  });

  it("standart video ko'rinadi; darsi yo'q mavzu — null", async () => {
    const res = await http().get(`/admin/content/topics/${SLUG}/lesson`).set(admin).expect(200);
    expect(res.body.lesson).toMatchObject({ lessonId: SLUG, videoId: DEFAULT.videoId, durationSec: 600, overridden: false });
    const none = await http().get(`/admin/content/topics/${NO_VIDEO_SLUG}/lesson`).set(admin).expect(200);
    expect(none.body.lesson).toBeNull();
    await http().put(`/admin/content/topics/${NO_VIDEO_SLUG}/lesson`).set(admin).send({ video: "BBBBBBBBBBB", durationSec: 60 }).expect(404);
  });

  it("validatsiya: noto'g'ri havola va davomiylik", async () => {
    await http().put(`/admin/content/topics/${SLUG}/lesson`).set(admin).send({ video: "https://vimeo.com/123", durationSec: 60 }).expect(400);
    await http().put(`/admin/content/topics/${SLUG}/lesson`).set(admin).send({ video: "BBBBBBBBBBB", durationSec: 0 }).expect(400);
    await http().put(`/admin/content/topics/${SLUG}/lesson`).set(admin).send({ video: "BBBBBBBBBBB", durationSec: 1.5 }).expect(400);
  });

  it("almashtirilgan video foydalanuvchiga darhol beriladi, asl holatga qaytadi, audit yoziladi", async () => {
    const res = await http()
      .put(`/admin/content/topics/${SLUG}/lesson`)
      .set(admin)
      .send({ video: "https://youtu.be/BBBBBBBBBBB?t=3", durationSec: 321 })
      .expect(200);
    expect(res.body).toMatchObject({ videoId: "BBBBBBBBBBB", durationSec: 321, defaultVideoId: DEFAULT.videoId, overridden: true });

    const video = await http().get(`/lessons/${SLUG}/video`).set(user).expect(200);
    expect(video.body).toEqual({ videoId: "BBBBBBBBBBB" });
    const list = await http().get("/lessons").set(user).expect(200);
    expect((list.body as { lessonId: string; durationSec: number }[]).find((l) => l.lessonId === SLUG)?.durationSec).toBe(321);

    const reset = await http().delete(`/admin/content/topics/${SLUG}/lesson`).set(admin).expect(200);
    expect(reset.body).toMatchObject({ videoId: DEFAULT.videoId, durationSec: 600, overridden: false });
    expect((await http().get(`/lessons/${SLUG}/video`).set(user).expect(200)).body).toEqual({ videoId: DEFAULT.videoId });

    const actions = (await prisma.auditLog.findMany({ where: { entityType: "lesson", entityId: SLUG }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["lesson.video.updated", "lesson.video.reset"]);
  });
});
