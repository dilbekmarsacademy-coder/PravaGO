import { ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { getDummyHash, verifySecret } from "../admin/password";
import { deviceLabel } from "../common/device";
import { normalizePhone } from "../common/phone";
import { SESSION_TTL_MS, hashToken, newSessionToken } from "./auth.service";
import { normalizeLogin } from "./center-credentials";

/** Login bo'yicha: 15 daqiqada 5 ta xato urinishdan keyin blok. */
export const CENTER_LOGIN_MAX_FAILURES = 5;
/**
 * IP bo'yicha chegara kattaroq: markazdagi o'quvchilar odatda bitta umumiy
 * IP'dan (Wi-Fi) kiradi — bir kishining xatolari butun sinfni bloklamasin.
 */
export const CENTER_LOGIN_MAX_IP_FAILURES = 20;
export const CENTER_LOGIN_WINDOW_MS = 15 * 60 * 1000;
/** Eski (almashtirilgan) sessiyalar shuncha vaqt saqlanadi — eski qurilma aniq "SESSION_REPLACED" oladi. */
const STALE_SESSION_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

const INVALID = "Telefon, login yoki parol noto'g'ri";

@Injectable()
export class CenterAuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Telefon + login + parol — uchalasi bitta markaz akkauntiga mos kelishi shart.
   * Qaysi biri xato ekani aytilmaydi; login topilmasa ham parol xeshi
   * tekshiriladi (vaqt bo'yicha farq qilmasligi uchun).
   *
   * Yagona faol qurilma: yangi sessiya yaratiladi va User.activeSessionId
   * bitta UPDATE bilan uning ustiga yoziladi — oxirgi yozilgan g'olib, oldingi
   * barcha sessiyalar keyingi so'rovda 401 SESSION_REPLACED oladi.
   */
  async login(
    input: { phone: string; login: string; password: string },
    ip: string,
    userAgent: string | undefined,
  ): Promise<{ token: string; expiresAt: Date }> {
    const login = normalizeLogin(input.login).slice(0, 100);
    const phone = normalizePhone(input.phone);
    const ua = userAgent?.slice(0, 300) || null;

    const since = new Date(Date.now() - CENTER_LOGIN_WINDOW_MS);
    const failed = { success: false, reason: { not: "rate_limited" }, createdAt: { gte: since } };
    const [ipFailures, loginFailures] = await Promise.all([
      this.prisma.userLoginAttempt.count({ where: { ip, ...failed } }),
      this.prisma.userLoginAttempt.count({ where: { login, ...failed } }),
    ]);
    if (ipFailures >= CENTER_LOGIN_MAX_IP_FAILURES || loginFailures >= CENTER_LOGIN_MAX_FAILURES) {
      await this.prisma.userLoginAttempt.create({ data: { login, ip, success: false, reason: "rate_limited", userAgent: ua } });
      throw new HttpException(
        { statusCode: 429, code: "LOGIN_RATE_LIMITED", message: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = login
      ? await this.prisma.user.findUnique({
          where: { login },
          select: { id: true, type: true, phone: true, passwordHash: true, isActive: true },
        })
      : null;
    const passwordOk = await verifySecret(user?.passwordHash ?? (await getDummyHash()), input.password);
    const matches = Boolean(user && user.type === "CENTER" && passwordOk && phone && user.phone === phone);

    if (!user || !matches) {
      await this.prisma.userLoginAttempt.create({ data: { login, ip, success: false, reason: "bad_credentials", userAgent: ua } });
      throw new UnauthorizedException({ statusCode: 401, code: "INVALID_CREDENTIALS", message: INVALID });
    }
    if (!user.isActive) {
      await this.prisma.userLoginAttempt.create({ data: { login, ip, success: false, reason: "inactive", userAgent: ua } });
      throw new ForbiddenException({ statusCode: 403, code: "ACCOUNT_INACTIVE", message: "Akkaunt faol emas, markazga murojaat qiling" });
    }

    const token = newSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: { userId: user.id, tokenHash: hashToken(token), userAgent: ua, lastSeenAt: now, expiresAt },
        select: { id: true },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { activeSessionId: created.id, lastLoginAt: now, lastActiveAt: now, lastDevice: ua ? deviceLabel(ua) : null },
      });
      await tx.session.deleteMany({ where: { userId: user.id, id: { not: created.id }, createdAt: { lt: new Date(now.getTime() - STALE_SESSION_KEEP_MS) } } });
      await tx.userLoginAttempt.create({ data: { login, ip, success: true, reason: "ok", userAgent: ua } });
      return created;
    });

    // Bir vaqtdagi ikki kirish: ikkinchisi bizdan keyin yozgan bo'lsa, bu kirish
    // endi amalda emas — "kirdim" deb qolmasligi uchun darhol aytamiz.
    const current = await this.prisma.user.findUnique({ where: { id: user.id }, select: { activeSessionId: true } });
    if (current?.activeSessionId !== session.id) {
      throw new UnauthorizedException({ statusCode: 401, code: "SESSION_REPLACED", message: "Bu akkauntga boshqa qurilmadan kirildi" });
    }
    return { token, expiresAt };
  }
}
