import { ForbiddenException, Injectable } from "@nestjs/common";
import type { UserPaymentStatus, UserType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Kurs kontentiga (video, test, javob tekshiruvi, kalit so'zlar, "Yangi
 * testlar") kirish huquqi. Tekshiruv faqat shu yerda — frontend faqat natijani
 * ko'rsatadi. `PAYMENT_ENFORCED=true` bo'lsa tasdiqlangan to'lov talab qilinadi;
 * o'chirilgan bo'lsa (lokal/e2e) hamma sessiyaga ochiq.
 *
 * Markaz o'quvchisi (type=CENTER): to'lov o'rniga `centerAccess` (standart —
 * yoqilgan, to'lagan foydalanuvchi bilan teng). Admin o'chirsa, to'lov
 * shartidan qat'i nazar kirish yopiladi.
 */
export function paymentEnforced(): boolean {
  return process.env.PAYMENT_ENFORCED === "true";
}

export interface AccessFields {
  type: UserType;
  centerAccess: boolean;
  paymentStatus: UserPaymentStatus;
  /** Onlayn obuna (Payme) tugash vaqti. */
  subscriptionUntil: Date | null;
  /** Premium/Mentor (muddatsiz). */
  subscriptionUnlimited: boolean;
}

/** Kirish huquqi — AccessService va GET /me shu bitta funksiyadan foydalanadi. */
export function computeCourseAccess(user: AccessFields): boolean {
  if (user.type === "CENTER") return user.centerAccess;
  return !paymentEnforced() || user.paymentStatus === "PAID" || user.subscriptionUnlimited || (user.subscriptionUntil !== null && user.subscriptionUntil.getTime() > Date.now());
}

/**
 * Videodarslarga kirish. Cheklov FAQAT onlayn Standart obunasiga: kirishi shu
 * obuna bilangina ochilgan foydalanuvchi videoni ko'rmaydi. Markaz o'quvchilari,
 * qo'lda tasdiqlanganlar, Premium/Mentor va admin ochib qo'yganlar (unlockAll) — avvalgidek.
 */
export function computeVideoAccess(user: AccessFields & { unlockAll: boolean }): boolean {
  if (!computeCourseAccess(user)) return false;
  return user.type === "CENTER" || !paymentEnforced() || user.paymentStatus === "PAID" || user.subscriptionUnlimited || user.unlockAll;
}

const ACCESS_SELECT = { paymentStatus: true, type: true, centerAccess: true, subscriptionUntil: true, subscriptionUnlimited: true, unlockAll: true } as const;

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async hasCourseAccess(userId: string | undefined): Promise<boolean> {
    if (!userId) return !paymentEnforced();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: ACCESS_SELECT });
    if (!user) return !paymentEnforced();
    return computeCourseAccess(user);
  }

  /** Kirishi bor, lekin videosiz (onlayn Standart): test video shartisiz ochiladi. */
  async isTestsOnly(userId: string | undefined): Promise<boolean> {
    if (!userId) return false;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: ACCESS_SELECT });
    return user !== null && computeCourseAccess(user) && !computeVideoAccess(user);
  }

  async assertVideoAccess(userId: string): Promise<void> {
    await this.assertCourseAccess(userId);
    if (await this.isTestsOnly(userId)) {
      throw new ForbiddenException({ statusCode: 403, code: "VIDEO_NOT_INCLUDED", message: "Videodarslar Premium va Mentor tariflarida" });
    }
  }

  /** Admin bu o'quvchiga hamma narsani ochib qo'ygan (video va kalit so'z sharti yo'q). */
  async hasUnlockAll(userId: string | undefined): Promise<boolean> {
    if (!userId) return false;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { unlockAll: true } });
    return user?.unlockAll ?? false;
  }

  /**
   * Kunlik mavzu oqimi bayroqlari: `unlockAll` (admin hammasini ochgan — oqim
   * talab qilinmaydi) va `gated` (User.topicFlowGatingEnabled: video →
   * "Tanishib chiqdim" → test majburiy).
   */
  async flowFlags(userId: string | undefined): Promise<{ unlockAll: boolean; gated: boolean }> {
    if (!userId) return { unlockAll: false, gated: false };
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { unlockAll: true, topicFlowGatingEnabled: true } });
    return { unlockAll: user?.unlockAll ?? false, gated: user?.topicFlowGatingEnabled ?? false };
  }

  async assertCourseAccess(userId: string | undefined): Promise<void> {
    if (await this.hasCourseAccess(userId)) return;
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { type: true } });
      if (user?.type === "CENTER") {
        throw new ForbiddenException({
          statusCode: 403,
          code: "CENTER_ACCESS_DISABLED",
          message: "Kursga kirish markaz tomonidan vaqtincha yopilgan. Markazga murojaat qiling.",
        });
      }
    }
    throw new ForbiddenException({
      statusCode: 403,
      code: "PAYMENT_REQUIRED",
      message: "Kursga kirish to'lov tasdiqlangandan keyin ochiladi",
    });
  }
}
