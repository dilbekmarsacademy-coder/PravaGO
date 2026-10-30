import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { hashToken } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  ADMIN_SESSION_TTL_MS,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
  accessCodeHash,
  adminSessionSecret,
} from "./admin-config";
import type { AdminUser } from "./admin-request";
import { AuditService } from "./audit.service";
import { getDummyHash, hashSecret, verifySecret } from "./password";

export interface AdminProfileDto {
  id: string;
  name: string;
  login: string;
  role: string;
  lastLoginAt: Date | null;
}

const INVALID = "Kirish ma'lumotlari noto'g'ri";

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Maxsus kod + login + parol. Qaysi biri xato ekani tashqariga aytilmaydi va
   * har uchala tekshiruv bajariladi (vaqt bo'yicha farq qilmasligi uchun).
   * Rate limit: 15 daqiqada 5 ta muvaffaqiyatsiz urinish — IP va login bo'yicha alohida.
   */
  async login(
    input: { accessCode: string; login: string; password: string },
    ip: string,
    userAgent: string | undefined,
  ): Promise<{ token: string; expiresAt: Date; admin: AdminProfileDto }> {
    const codeHash = accessCodeHash();
    if (!codeHash || !adminSessionSecret()) {
      throw new ServiceUnavailableException({ statusCode: 503, code: "ADMIN_NOT_CONFIGURED", message: "Admin panel sozlanmagan" });
    }
    const login = input.login.trim().toLowerCase();
    const ua = userAgent?.slice(0, 300);

    const since = new Date(Date.now() - LOGIN_WINDOW_MS);
    const [ipFailures, loginFailures] = await Promise.all([
      // Bloklangan paytdagi urinishlar hisoblanmaydi — aks holda blok o'zini o'zi uzaytiradi.
      this.prisma.adminLoginAttempt.count({ where: { ip, success: false, reason: { not: "rate_limited" }, createdAt: { gte: since } } }),
      this.prisma.adminLoginAttempt.count({ where: { login, success: false, reason: { not: "rate_limited" }, createdAt: { gte: since } } }),
    ]);
    if (ipFailures >= LOGIN_MAX_FAILURES || loginFailures >= LOGIN_MAX_FAILURES) {
      await this.prisma.adminLoginAttempt.create({ data: { login, ip, success: false, reason: "rate_limited", userAgent: ua } });
      throw new HttpException(
        { statusCode: 429, code: "ADMIN_LOGIN_RATE_LIMITED", message: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const admin = await this.prisma.admin.findUnique({ where: { login } });
    const [codeOk, passwordOk] = await Promise.all([
      verifySecret(codeHash, input.accessCode),
      verifySecret(admin?.passwordHash ?? (await getDummyHash()), input.password),
    ]);

    const reason = !codeOk ? "bad_code" : !admin || !passwordOk ? "bad_credentials" : !admin.active ? "inactive" : "ok";
    if (reason !== "ok" || !admin) {
      await this.prisma.adminLoginAttempt.create({ data: { login, ip, success: false, reason, userAgent: ua } });
      throw new UnauthorizedException({ statusCode: 401, code: "ADMIN_INVALID_CREDENTIALS", message: INVALID });
    }

    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ADMIN_SESSION_TTL_MS);
    await this.prisma.$transaction([
      this.prisma.adminLoginAttempt.create({ data: { login, ip, success: true, reason: "ok", userAgent: ua } }),
      this.prisma.adminSession.create({ data: { adminId: admin.id, tokenHash: hashToken(token), ip, userAgent: ua, expiresAt } }),
      this.prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: now } }),
      // Eski, muddati o'tgan sessiyalarni tozalab boramiz.
      this.prisma.adminSession.deleteMany({ where: { adminId: admin.id, expiresAt: { lt: now } } }),
    ]);
    await this.audit.log({ id: admin.id }, ip, { action: "admin.login", entityType: "admin", entityId: admin.id });
    return { token, expiresAt, admin: toProfile({ ...admin, lastLoginAt: now }) };
  }

  async logout(admin: AdminUser, ip: string): Promise<void> {
    await this.prisma.adminSession.update({ where: { id: admin.sessionId }, data: { revokedAt: new Date() } });
    await this.audit.log(admin, ip, { action: "admin.logout", entityType: "admin", entityId: admin.id });
  }

  async me(admin: AdminUser): Promise<AdminProfileDto> {
    const row = await this.prisma.admin.findUniqueOrThrow({ where: { id: admin.id } });
    return toProfile(row);
  }

  /** Parolni o'zgartirish — joriy paroldan tashqari barcha boshqa sessiyalar bekor qilinadi. */
  async changePassword(admin: AdminUser, currentPassword: string, newPassword: string, ip: string): Promise<void> {
    const row = await this.prisma.admin.findUniqueOrThrow({ where: { id: admin.id } });
    if (!(await verifySecret(row.passwordHash, currentPassword))) {
      throw new BadRequestException({ statusCode: 400, code: "ADMIN_WRONG_PASSWORD", message: "Joriy parol noto'g'ri" });
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException({ statusCode: 400, code: "ADMIN_SAME_PASSWORD", message: "Yangi parol eskisidan farq qilishi kerak" });
    }
    const passwordHash = await hashSecret(newPassword);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.admin.update({ where: { id: admin.id }, data: { passwordHash, passwordChangedAt: now } }),
      this.prisma.adminSession.updateMany({
        where: { adminId: admin.id, id: { not: admin.sessionId }, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
    await this.audit.log(admin, ip, { action: "admin.password_changed", entityType: "admin", entityId: admin.id });
  }

  /** Oxirgi kirish urinishlari (muvaffaqiyatsizlari ham) — "Tarix" sahifasi uchun. */
  async loginAttempts(limit: number) {
    return this.prisma.adminLoginAttempt.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  }
}

function toProfile(row: { id: string; name: string; login: string; role: string; lastLoginAt: Date | null }): AdminProfileDto {
  return { id: row.id, name: row.name, login: row.login, role: row.role, lastLoginAt: row.lastLoginAt };
}
