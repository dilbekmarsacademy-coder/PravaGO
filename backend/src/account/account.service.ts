import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizePhone } from "../common/phone";
import { coursePrice } from "../common/prices";
import { computeCourseAccess, paymentEnforced } from "../access/access.service";
import { syncUserPaymentStatus } from "../payments/payments.service";
import type { RegisterDto } from "./account.dto";

/**
 * Foydalanuvchining o'z akkaunti. Telefon raqami javobda QAYTARILMAYDI
 * (faqat admin API'da) — klient uni o'zi kiritgan holda biladi.
 */
export interface MeDto {
  registered: boolean;
  profile: { firstName: string; lastName: string; age: number | null; examStatus: string | null; preferredLanguage: string | null } | null;
  payment: { status: "NONE" | "PENDING" | "PAID"; amount: number; pendingSince: Date | null };
  /** Kurs kontentiga kirish (backend tekshiruvi bilan bir xil). */
  access: boolean;
  paymentRequired: boolean;
  /** "CENTER" — markaz o'quvchisi (login + parol, bitta faol qurilma). */
  type: "SELF" | "CENTER";
}

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { payments: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const registered = Boolean(user.registeredAt);
    return {
      registered,
      profile: registered
        ? {
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
            age: user.age,
            examStatus: user.examStatus,
            preferredLanguage: user.preferredLanguage,
          }
        : null,
      payment: {
        status: user.paymentStatus,
        amount: user.payments[0]?.amount ?? coursePrice(user.examStatus),
        pendingSince: user.payments[0]?.createdAt ?? null,
      },
      access: computeCourseAccess(user),
      paymentRequired: user.type === "CENTER" ? false : paymentEnforced(),
      type: user.type,
    };
  }

  /**
   * Ro'yxatdan o'tish: profil shu qurilma sessiyasining foydalanuvchisiga
   * yoziladi — oldingi progress (video, test, saqlanganlar) o'sha foydalanuvchida
   * qoladi. Raqam boshqa akkauntda bo'lsa — 409 (tasdiqlashsiz bog'lab bo'lmaydi;
   * telefon OTP qo'shilgach shu yerda akkauntga ulanadi).
   */
  async register(userId: string, input: RegisterDto): Promise<MeDto> {
    const phone = normalizePhone(input.phone);
    if (!phone) throw new BadRequestException({ statusCode: 400, code: "PHONE_INVALID", message: "Telefon raqam noto'g'ri" });

    const owner = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (owner && owner.id !== userId) {
      throw new ConflictException({
        statusCode: 409,
        code: "PHONE_TAKEN",
        message: "Bu raqam bilan ro'yxatdan o'tilgan. Yangi qurilmani ulash uchun administratorga murojaat qiling.",
      });
    }
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    // Markaz o'quvchisining profilini admin boshqaradi.
    if (current.type === "CENTER") return this.me(userId);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            age: input.age,
            phone,
            examStatus: input.examStatus,
            preferredLanguage: input.preferredLanguage ?? current.preferredLanguage,
            registeredAt: current.registeredAt ?? new Date(),
            lastActiveAt: new Date(),
          },
        });
        if (input.legacyStatus === "active" && current.paymentStatus === "NONE") {
          await tx.payment.create({
            data: {
              userId,
              amount: coursePrice(input.examStatus),
              status: "PENDING",
              method: "manual",
              userNote: "Avvalgi versiyada (sinov to'lovi) faollashtirilgan — tekshirib tasdiqlang",
            },
          });
          await syncUserPaymentStatus(tx, userId);
        }
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException({ statusCode: 409, code: "PHONE_TAKEN", message: "Bu raqam bilan ro'yxatdan o'tilgan" });
      }
      throw err;
    }
    return this.me(userId);
  }

  async setLanguage(userId: string, preferredLanguage: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { preferredLanguage } });
  }
}
