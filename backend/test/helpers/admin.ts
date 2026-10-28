import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { adminProxyKey } from "../../src/admin/admin-config";
import { hashSecret } from "../../src/admin/password";
import type { PrismaService } from "../../src/prisma/prisma.service";

// Admin e2e testlari uchun: sirlar test jarayonida o'rnatiladi (env so'rov vaqtida o'qiladi).
export const TEST_ADMIN_SECRET = "e2e-admin-session-secret-0123456789abcdef0123456789abcdef";
export const TEST_ACCESS_CODE = "K7m2Q9xz";

export async function configureAdminEnv(): Promise<void> {
  process.env.ADMIN_SESSION_SECRET = TEST_ADMIN_SECRET;
  process.env.ADMIN_ACCESS_CODE_HASH = Buffer.from(await hashSecret(TEST_ACCESS_CODE)).toString("base64");
}

export function proxyHeaders(ip = "10.0.0.1"): Record<string, string> {
  return { "x-admin-proxy-key": adminProxyKey(TEST_ADMIN_SECRET), "x-admin-client-ip": ip };
}

export async function createTestAdmin(prisma: PrismaService, login: string, password: string): Promise<string> {
  await prisma.admin.deleteMany({ where: { login } });
  const admin = await prisma.admin.create({ data: { login, name: login, role: "OWNER", passwordHash: await hashSecret(password) } });
  return admin.id;
}

/** Kirib, admin so'rovlari uchun sarlavhalarni qaytaradi. */
export async function adminHeaders(app: INestApplication, login: string, password: string, ip = "10.9.9.9"): Promise<Record<string, string>> {
  const res = await request(app.getHttpServer())
    .post("/admin/auth/login")
    .set(proxyHeaders(ip))
    .send({ accessCode: TEST_ACCESS_CODE, login, password })
    .expect(200);
  return { ...proxyHeaders(ip), "x-admin-session": (res.body as { token: string }).token };
}
