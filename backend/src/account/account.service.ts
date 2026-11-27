import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, type Tariff } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizePhone } from "../common/phone";
import { OFFER_VERSION, registrationsPerIpPerHour } from "../common/registration";
import { MANUAL_REQUEST_PRICE } from "../payments/tariffs";
import { computeCourseAccess, computeVideoAccess, paymentEnforced } from "../access/access.service";
import { syncUserPaymentStatus } from "../payments/payments.service";
import { skipsAnswerConfirm } from "../common/answer-confirm";
import type { RegisterDto } from "./account.dto";

/**
 * Foydalanuvchining o'z akkaunti. Telefon raqami javobda QAYTARILMAYDI
 * (faqat admin API'da) — klient uni o'zi kiritgan holda biladi.
 */
export interface MeDto {
  registered: boolean;
  profile: { firstName: string; lastName: string; age: number | null; examStatus: string | null; preferredLanguage: string | null } | null;
  payment: { status: "NONE" | "PENDING" | "PAID"; amount: number; pendingSince: Date | null };
  /** Onlayn obuna (Payme) — bo'lmasa null. `expiresAt` null — muddatsiz; o'tmishda — tugagan. */
  subscription: { tariff: Tariff | null; expiresAt: Date | null } | null;
  /** Kurs kontentiga kirish (backend tekshiruvi bilan bir xil). */
  access: boolean;
  /** Videodarslar ochiqmi (onlayn Standart — faqat testlar). */
  videoAccess: boolean;
  paymentRequired: boolean;
  /** "CENTER" — markaz o'quvchisi (login + parol, bitta faol qurilma). */
  type: "SELF" | "CENTER";
  /** Admin hamma narsani ochib qo'ygan: kunlar/mavzular qulfsiz, test video va kalit so'zsiz. */
  unlockAll: boolean;
  /** Admin barcha videodarslarni ochib qo'ygan: kunlar/mavzular video uchun qulfsiz (test sharti o'zgarmaydi). */
  videosUnlocked: boolean;
  /** Kunlik mavzu oqimi majburiy: video → kalit so'zlar → test. */
  topicFlowGating: boolean;
  /** Javobni tasdiqlash paneli ko'rsatilmaydi (ANSWER_CONFIRM_SKIP_USERS ro'yxati, serverda hisoblanadi). */
  skipAnswerConfirm: boolean;
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
        amount: user.payments[0]?.amount ?? MANUAL_REQUEST_PRICE,
        pendingSince: user.payments[0]?.createdAt ?? null,
      },
      subscription: user.subscriptionUnlimited || user.subscriptionUntil ? { tariff: user.subscriptionTariff, expiresAt: user.subscriptionUnlimited ? null : user.subscriptionUntil } : null,
      access: computeCourseAccess(user),
      videoAccess: computeVideoAccess(user),
      paymentRequired: user.type === "CENTER" ? false : paymentEnforced(),
      type: user.type,
      unlockAll: user.unlockAll,
      videosUnlocked: user.videosUnlocked,
      topicFlowGating: user.topicFlowGatingEnabled,
      skipAnswerConfirm: skipsAnswerConfirm(user),
    };
  }

  /**
   * Ro'yxatdan o'tish: profil shu qurilma sessiyasining foydalanuvchisiga
   * yoziladi — oldingi progress (video, test, saqlanganlar) o'sha foydalanuvchida
   * qoladi. Raqam boshqa akkauntda bo'lsa — 409 (tasdiqlashsiz bog'lab bo'lmaydi;
   * telefon OTP qo'shilgach shu yerda akkauntga ulanadi).
   */
  async register(userId: string, input: RegisterDto, ip?: string): Promise<MeDto> {
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
    // SMS tasdig'i yo'q — bir IP'dan yangi ro'yxatdan o'tishlar soni cheklanadi (profilni yangilash hisobga kirmaydi).
    if (!current.registeredAt && ip) {
      const recent = await this.prisma.user.count({ where: { registrationIp: ip, registeredAt: { gte: new Date(Date.now() - 3600_000) } } });
      if (recent >= registrationsPerIpPerHour()) {
        throw new HttpException(
          { statusCode: 429, code: "REGISTER_RATE_LIMITED", message: "Bu tarmoqdan juda ko'p ro'yxatdan o'tildi. Birozdan keyin qayta urinib ko'ring." },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
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
            // Yangi ro'yxatdan o'tgan foydalanuvchi — yangi oqim (video → kalit so'zlar → test).
            ...(current.registeredAt ? {} : { registrationIp: ip ?? null, topicFlowGatingEnabled: true }),
            ...(input.consent && !current.consentAt ? { consentAt: new Date(), offerVersion: OFFER_VERSION } : {}),
          },
        });
        if (input.legacyStatus === "active" && current.paymentStatus === "NONE") {
          await tx.payment.create({
            data: {
              userId,
              amount: MANUAL_REQUEST_PRICE,
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
