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
}

/** Kirish huquqi — AccessService va GET /me shu bitta funksiyadan foydalanadi. */
export function computeCourseAccess(user: AccessFields): boolean {
  if (user.type === "CENTER") return user.centerAccess;
  return !paymentEnforced() || user.paymentStatus === "PAID";
}

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async hasCourseAccess(userId: string | undefined): Promise<boolean> {
    if (!userId) return !paymentEnforced();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { paymentStatus: true, type: true, centerAccess: true } });
    if (!user) return !paymentEnforced();
    return computeCourseAccess(user);
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
