import { ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { deviceLabel } from "../common/device";
import { SESSION_TTL_MS, hashToken, newSessionToken, type SessionUser } from "./auth.service";

// Domen ko'chishi: eski manzildagi (pravatayyor.vercel.app) tizimga kirgan
// foydalanuvchi yangi manzilda (pravaishonch.uz) qayta kirmasligi uchun.
// Eski domen sessiya bilan bir martalik kod oladi (URL'da faqat shu kod
// ketadi — token/parol emas), yangi domen uni 60 soniya ichida BIR MARTA
// yangi sessiyaga almashtiradi. Bazada faqat kodning sha256 xeshi turadi.

export const TRANSFER_CODE_TTL_MS = 60_000;
const CODE_BYTES = 32;

/** Kod faqat shu manzillardan so'raladi (env: TRANSFER_SOURCE_ORIGINS, vergul bilan). */
const DEFAULT_SOURCE_ORIGINS = ["https://pravatayyor.vercel.app"];
/** Kod faqat shu manzillarda almashtiriladi (env: TRANSFER_TARGET_ORIGINS). */
const DEFAULT_TARGET_ORIGINS = ["https://www.pravaishonch.uz", "https://pravaishonch.uz"];

function originsFromEnv(name: string, fallback: string[]): string[] {
  const value = process.env[name]?.trim();
  return value ? value.split(",").map((o) => o.trim()).filter(Boolean) : fallback;
}

export const transferSourceOrigins = () => originsFromEnv("TRANSFER_SOURCE_ORIGINS", DEFAULT_SOURCE_ORIGINS);
export const transferTargetOrigins = () => originsFromEnv("TRANSFER_TARGET_ORIGINS", DEFAULT_TARGET_ORIGINS);

const INVALID_CODE = { statusCode: 401, code: "TRANSFER_CODE_INVALID", message: "Kod yaroqsiz yoki muddati o'tgan — qaytadan kiring" };

@Injectable()
export class TransferService {
  constructor(private readonly prisma: PrismaService) {}

  /** Brauzer yuborgan `Origin` ruxsat etilgan ro'yxatda bo'lmasa — 403. */
  assertOrigin(origin: string | undefined, allowed: string[]): void {
    if (!origin || !allowed.includes(origin)) {
      throw new ForbiddenException({ statusCode: 403, code: "ORIGIN_NOT_ALLOWED", message: "Bu manzildan ruxsat yo'q" });
    }
  }

  async createCode(user: SessionUser): Promise<{ code: string; expiresAt: Date }> {
    const now = new Date();
    // Ishlatilmay qolgan eski kodlar — har chaqiruvda tozalanadi (indeks bo'yicha arzon).
    await this.prisma.sessionTransferCode.deleteMany({ where: { expiresAt: { lte: now } } });
    const code = randomBytes(CODE_BYTES).toString("base64url");
    const expiresAt = new Date(now.getTime() + TRANSFER_CODE_TTL_MS);
    await this.prisma.sessionTransferCode.create({ data: { codeHash: hashToken(code), userId: user.id, expiresAt } });
    return { code, expiresAt };
  }

  /**
   * Kod → yangi sessiya (markaz kirishidagi bilan bir xil). Kod darhol
   * o'chiriladi: parallel ikki so'rovdan faqat bittasi `deleteMany` da 1 oladi.
   * Markaz o'quvchisida yangi sessiya yagona faol sessiya bo'ladi — eski
   * domendagi sessiya keyingi so'rovida SESSION_REPLACED oladi.
   */
  async exchange(code: string, userAgent: string | undefined): Promise<{ token: string; expiresAt: Date; center: boolean }> {
    const codeHash = hashToken(code);
    const now = new Date();
    const row = await this.prisma.sessionTransferCode.findUnique({ where: { codeHash }, select: { userId: true, expiresAt: true } });
    const { count } = await this.prisma.sessionTransferCode.deleteMany({ where: { codeHash } });
    if (!row || count === 0 || row.expiresAt.getTime() <= now.getTime()) throw new UnauthorizedException(INVALID_CODE);

    const user = await this.prisma.user.findUnique({ where: { id: row.userId }, select: { id: true, type: true, isActive: true } });
    if (!user) throw new UnauthorizedException(INVALID_CODE);
    if (!user.isActive) {
      throw new ForbiddenException({ statusCode: 403, code: "ACCOUNT_INACTIVE", message: "Akkaunt faol emas, markazga murojaat qiling" });
    }

    const ua = userAgent?.slice(0, 300) || null;
    const token = newSessionToken();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const center = user.type === "CENTER";
    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: { userId: user.id, tokenHash: hashToken(token), userAgent: ua, lastSeenAt: now, expiresAt },
        select: { id: true },
      });
      await tx.user.update({
        where: { id: user.id },
        data: center
          ? { activeSessionId: created.id, lastLoginAt: now, lastActiveAt: now, lastDevice: ua ? deviceLabel(ua) : null }
          : { lastActiveAt: now },
      });
      return created;
    });
    if (center) {
      const current = await this.prisma.user.findUnique({ where: { id: user.id }, select: { activeSessionId: true } });
      if (current?.activeSessionId !== session.id) {
        throw new HttpException({ statusCode: 401, code: "SESSION_REPLACED", message: "Bu akkauntga boshqa qurilmadan kirildi" }, HttpStatus.UNAUTHORIZED);
      }
    }
    return { token, expiresAt, center };
  }
}
