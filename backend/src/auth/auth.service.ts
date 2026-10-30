import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

// Qurilma sessiyasi: birinchi murojaatda yangi anonim foydalanuvchi va tasodifiy
// token yaratiladi. Token faqat klientda turadi — bazada uning sha256 xeshi.
// Markaz o'quvchilari (type=CENTER) login + parol bilan kiradi (CenterAuthService)
// va bir vaqtda faqat bitta faol sessiyaga ega (User.activeSessionId).

const TOKEN_BYTES = 32;
export const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;
/** Oxirgi faollik shundan tez-tez yozilmaydi (har so'rovda bazaga yozmaslik uchun). */
const ACTIVITY_WRITE_INTERVAL_MS = 5 * 60 * 1000;

export interface SessionUser {
  id: string;
  /** Session.id — markaz o'quvchisining yagona faol sessiyasi shu bilan solishtiriladi. */
  sessionId: string;
  type: "SELF" | "CENTER";
}

/**
 * Token bor, lekin endi amal qilmaydi — klient sababni bilishi uchun aniq kod:
 * - SESSION_REPLACED — shu akkauntga boshqa qurilmadan kirildi;
 * - SESSION_REVOKED — admin qurilmadan chiqardi yoki parolni yangiladi;
 * - ACCOUNT_INACTIVE — akkaunt faolsizlantirilgan.
 */
export type SessionRejection = "SESSION_REPLACED" | "SESSION_REVOKED" | "ACCOUNT_INACTIVE";

export type ResolvedToken = { user: SessionUser } | { rejected: SessionRejection } | null;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async createAnonymousSession(userAgent?: string): Promise<{ token: string; expiresAt: Date }> {
    const token = newSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await this.prisma.user.create({
      data: {
        lastActiveAt: now,
        sessions: { create: { tokenHash: hashToken(token), expiresAt, lastSeenAt: now, userAgent: userAgent?.slice(0, 300) || null } },
      },
    });
    return { token, expiresAt };
  }

  /**
   * Token bo'yicha foydalanuvchini topadi (bitta so'rov: sessiya + foydalanuvchi holati).
   * Token noto'g'ri, muddati o'tgan yoki foydalanuvchi o'chirilgan bo'lsa — null.
   */
  async resolveToken(token: string): Promise<ResolvedToken> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        lastSeenAt: true,
        user: { select: { type: true, isActive: true, activeSessionId: true } },
      },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    const { user } = session;
    if (!user.isActive) return { rejected: "ACCOUNT_INACTIVE" };
    if (user.type === "CENTER" && user.activeSessionId !== session.id) {
      return { rejected: user.activeSessionId ? "SESSION_REPLACED" : "SESSION_REVOKED" };
    }
    if (!session.lastSeenAt || Date.now() - session.lastSeenAt.getTime() > ACTIVITY_WRITE_INTERVAL_MS) {
      const now = new Date();
      // Oxirgi faollik (admin panel) — so'rovni kutdirmaydi.
      Promise.all([
        this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } }),
        this.prisma.user.update({ where: { id: session.userId }, data: { lastActiveAt: now } }),
      ]).catch(() => undefined);
    }
    return { user: { id: session.userId, sessionId: session.id, type: user.type } };
  }

  /** Chiqish: shu qurilma sessiyasi o'chiriladi (markaz o'quvchisida faol sessiya ham bo'shaydi). */
  async logout(user: SessionUser): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.updateMany({ where: { id: user.id, activeSessionId: user.sessionId }, data: { activeSessionId: null } }),
      this.prisma.session.deleteMany({ where: { id: user.sessionId } }),
    ]);
  }
}
