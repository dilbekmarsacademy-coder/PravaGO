import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

// Anonim qurilma sessiyasi: birinchi murojaatda yangi foydalanuvchi va tasodifiy
// token yaratiladi. Token faqat klientda turadi — bazada uning sha256 xeshi.
// Real login (telefon + OTP) qo'shilganda shu servis kengaytiriladi va anonim
// foydalanuvchi akkauntga bog'lanadi.

const TOKEN_BYTES = 32;
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;
/** Oxirgi faollik shundan tez-tez yozilmaydi (har so'rovda bazaga yozmaslik uchun). */
const ACTIVITY_WRITE_INTERVAL_MS = 5 * 60 * 1000;

export interface SessionUser {
  id: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async createAnonymousSession(userAgent?: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
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

  /** Token bo'yicha foydalanuvchini topadi; token noto'g'ri yoki muddati o'tgan bo'lsa — null. */
  async resolveToken(token: string): Promise<SessionUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, userId: true, expiresAt: true, lastSeenAt: true },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    if (!session.lastSeenAt || Date.now() - session.lastSeenAt.getTime() > ACTIVITY_WRITE_INTERVAL_MS) {
      const now = new Date();
      // Oxirgi faollik (admin panel) — so'rovni kutdirmaydi.
      Promise.all([
        this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } }),
        this.prisma.user.update({ where: { id: session.userId }, data: { lastActiveAt: now } }),
      ]).catch(() => undefined);
    }
    return { id: session.userId };
  }
}
