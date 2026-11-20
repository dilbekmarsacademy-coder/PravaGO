import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AuthService, hashToken } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { answerConfirmSkipList, skipsAnswerConfirm } from "../src/common/answer-confirm";

// GET /me → skipAnswerConfirm: ANSWER_CONFIRM_SKIP_USERS ro'yxatidan serverda hisoblanadi.
const LOGIN_PREFIX = "e2e-acs-";

let app: INestApplication;
let prisma: PrismaService;
const http = () => request(app.getHttpServer());
const ORIGINAL = process.env.ANSWER_CONFIRM_SKIP_USERS;

async function newUser(data: { login?: string; firstName?: string; lastName?: string } = {}) {
  const { token } = await app.get(AuthService).createAnonymousSession();
  const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  await prisma.user.update({ where: { id: session.userId }, data });
  return { Authorization: `Bearer ${token}` };
}

async function skipFlag(auth: Record<string, string>): Promise<unknown> {
  return (await http().get("/me").set(auth).expect(200)).body.skipAnswerConfirm;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ANSWER_CONFIRM_SKIP_USERS;
  else process.env.ANSWER_CONFIRM_SKIP_USERS = ORIGINAL;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { login: { startsWith: LOGIN_PREFIX } } });
  await app.close();
});

describe("skipsAnswerConfirm (sof funksiya)", () => {
  it("standart ro'yxat — MuhammadUmar; bo'sh qator — hech kim", () => {
    expect([...answerConfirmSkipList(undefined)]).toEqual(["muhammadumar"]);
    expect(answerConfirmSkipList("").size).toBe(0);
    expect([...answerConfirmSkipList(" Foo , ,bar Baz ")]).toEqual(["foo", "barbaz"]);
  });

  it("katta-kichik harf va bo'shliqqa e'tiborsiz; login yoki to'liq ism (ikkala tartib)", () => {
    const list = answerConfirmSkipList("MuhammadUmar");
    expect(skipsAnswerConfirm({ login: "MUHAMMADUMAR", firstName: null, lastName: null }, list)).toBe(true);
    expect(skipsAnswerConfirm({ login: "x1", firstName: "umar", lastName: "MUHAMMAD" }, list)).toBe(true);
    expect(skipsAnswerConfirm({ login: null, firstName: "Muhammad ", lastName: " Umar" }, list)).toBe(true);
    expect(skipsAnswerConfirm({ login: null, firstName: "Muhammad Umar", lastName: "" }, list)).toBe(false);
    expect(skipsAnswerConfirm({ login: "muhammadumar2", firstName: "Umar", lastName: "Ali" }, list)).toBe(false);
    expect(skipsAnswerConfirm({ login: "muhammadumar", firstName: null, lastName: null }, new Set())).toBe(false);
  });
});

describe("GET /me → skipAnswerConfirm", () => {
  it("oddiy foydalanuvchi — false", async () => {
    delete process.env.ANSWER_CONFIRM_SKIP_USERS;
    const auth = await newUser({ login: `${LOGIN_PREFIX}plain`, firstName: "Ali", lastName: "Valiyev" });
    expect(await skipFlag(auth)).toBe(false);
    expect(await skipFlag(await newUser())).toBe(false);
  });

  it("standart ro'yxat: familiya+ism \"Muhammad Umar\" — true (harf registridan qat'i nazar)", async () => {
    delete process.env.ANSWER_CONFIRM_SKIP_USERS;
    const auth = await newUser({ login: `${LOGIN_PREFIX}mu`, firstName: "UMAR", lastName: "muhammad" });
    expect(await skipFlag(auth)).toBe(true);
  });

  it("env ro'yxati login bo'yicha (case-insensitive); ro'yxatdan chiqarilsa — false", async () => {
    const login = `${LOGIN_PREFIX}login1`;
    const auth = await newUser({ login, firstName: "Umar", lastName: "Muhammad" });
    process.env.ANSWER_CONFIRM_SKIP_USERS = `someone, ${login.toUpperCase()}`;
    expect(await skipFlag(auth)).toBe(true);
    process.env.ANSWER_CONFIRM_SKIP_USERS = "someone";
    expect(await skipFlag(auth)).toBe(false);
    process.env.ANSWER_CONFIRM_SKIP_USERS = "";
    expect(await skipFlag(auth)).toBe(false);
  });
});
