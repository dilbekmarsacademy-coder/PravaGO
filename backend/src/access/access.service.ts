import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Kurs kontentiga (video, test, javob tekshiruvi, kalit so'zlar, "Yangi
 * testlar") kirish huquqi. Tekshiruv faqat shu yerda — frontend faqat natijani
 * ko'rsatadi. `PAYMENT_ENFORCED=true` bo'lsa tasdiqlangan to'lov talab qilinadi;
 * o'chirilgan bo'lsa (lokal/e2e) hamma sessiyaga ochiq.
 */
export function paymentEnforced(): boolean {
  return process.env.PAYMENT_ENFORCED === "true";
}

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async hasCourseAccess(userId: string | undefined): Promise<boolean> {
    if (!paymentEnforced()) return true;
    if (!userId) return false;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { paymentStatus: true } });
    return user?.paymentStatus === "PAID";
  }

  async assertCourseAccess(userId: string | undefined): Promise<void> {
    if (await this.hasCourseAccess(userId)) return;
    throw new ForbiddenException({
      statusCode: 403,
      code: "PAYMENT_REQUIRED",
      message: "Kursga kirish to'lov tasdiqlangandan keyin ochiladi",
    });
  }
}
