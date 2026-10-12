import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

// Anonim qurilma sessiyasi: birinchi murojaatda yangi foydalanuvchi va tasodifiy
// token yaratiladi. Token faqat klientda turadi — bazada uning sha256 xeshi.
// Real login (telefon + OTP) qo'shilganda shu servis kengaytiriladi va anonim
// foydalanuvchi akkauntga bog'lanadi.

const TOKEN_BYTES = 32;
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async createAnonymousSession(): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.user.create({
      data: { sessions: { create: { tokenHash: hashToken(token), expiresAt } } },
    });
    return { token, expiresAt };
  }

  /** Token bo'yicha foydalanuvchini topadi; token noto'g'ri yoki muddati o'tgan bo'lsa — null. */
  async resolveToken(token: string): Promise<SessionUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { userId: true, expiresAt: true },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    return { id: session.userId };
  }
}
