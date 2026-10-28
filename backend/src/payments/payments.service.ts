import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Payment, PaymentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../admin/audit.service";
import type { AdminUser } from "../admin/admin-request";
import { coursePrice } from "../common/prices";

/**
 * Foydalanuvchining umumiy to'lov holati to'lovlar jadvalidan hisoblanadi:
 * kamida bitta tasdiqlangan — PAID, kutilayotgani bor — PENDING, aks holda NONE.
 */
export async function syncUserPaymentStatus(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const payments = await tx.payment.findMany({ where: { userId }, select: { status: true, confirmedAt: true } });
  const confirmed = payments
    .filter((p) => p.status === "CONFIRMED")
    .map((p) => p.confirmedAt?.getTime() ?? Date.now())
    .sort((a, b) => a - b);
  const paymentStatus = confirmed.length ? "PAID" : payments.some((p) => p.status === "PENDING") ? "PENDING" : "NONE";
  await tx.user.update({
    where: { id: userId },
    data: { paymentStatus, accessGrantedAt: confirmed.length ? new Date(confirmed[0]) : null },
  });
}

export interface MyPaymentDto {
  id: string;
  amount: number;
  status: PaymentStatus;
  createdAt: Date;
  confirmedAt: Date | null;
}

function toMine(p: Payment): MyPaymentDto {
  return { id: p.id, amount: p.amount, status: p.status, createdAt: p.createdAt, confirmedAt: p.confirmedAt };
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** /tolov: foydalanuvchi to'lov so'rovi. Kutilayotgani bo'lsa — o'sha qaytadi (takror yaratilmaydi). */
  async request(userId: string, userNote: string | undefined): Promise<MyPaymentDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.registeredAt) {
      throw new BadRequestException({ statusCode: 400, code: "NOT_REGISTERED", message: "Avval ro'yxatdan o'ting" });
    }
    if (user.paymentStatus === "PAID") {
      throw new ConflictException({ statusCode: 409, code: "ALREADY_PAID", message: "To'lov allaqachon tasdiqlangan" });
    }
    const pending = await this.prisma.payment.findFirst({ where: { userId, status: "PENDING" }, orderBy: { createdAt: "desc" } });
    if (pending) {
      if (userNote && userNote !== pending.userNote) {
        return toMine(await this.prisma.payment.update({ where: { id: pending.id }, data: { userNote } }));
      }
      return toMine(pending);
    }
    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: { userId, amount: coursePrice(user.examStatus), status: "PENDING", method: "manual", userNote: userNote || null },
      });
      await syncUserPaymentStatus(tx, userId);
      return created;
    });
    return toMine(payment);
  }

  async mine(userId: string): Promise<MyPaymentDto[]> {
    const rows = await this.prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 });
    return rows.map(toMine);
  }

  // ── Admin ──

  async list(params: { status?: PaymentStatus; page: number; pageSize: number; q?: string }) {
    const where: Prisma.PaymentWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.q ? { user: userSearch(params.q) } : {}),
    };
    const [total, pendingCount, rows] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.count({ where: { status: "PENDING" } }),
      // Kutilayotganlar tepada (enum tartibi: PENDING, CONFIRMED, CANCELLED), keyin yangilari.
      this.prisma.payment.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true, examStatus: true } },
          confirmedBy: { select: { login: true, name: true } },
          createdBy: { select: { login: true, name: true } },
        },
      }),
    ]);
    return { total, pendingCount, page: params.page, pageSize: params.pageSize, items: rows };
  }

  async create(
    admin: AdminUser,
    ip: string,
    input: { userId: string; amount?: number; status: "PENDING" | "CONFIRMED"; note?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          userId: user.id,
          amount: input.amount ?? coursePrice(user.examStatus),
          status: input.status,
          method: "manual",
          note: input.note || null,
          createdById: admin.id,
          ...(input.status === "CONFIRMED" ? { confirmedById: admin.id, confirmedAt: now } : {}),
        },
      });
      await syncUserPaymentStatus(tx, user.id);
      await this.audit.log(admin, ip, { action: "payment.created", entityType: "payment", entityId: payment.id, after: payment }, tx);
      return payment;
    });
  }

  async setStatus(admin: AdminUser, ip: string, paymentId: string, status: "CONFIRMED" | "CANCELLED", note?: string) {
    const before = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!before) throw new NotFoundException("To'lov topilmadi");
    if (before.status === status) return before;
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id: paymentId },
        data:
          status === "CONFIRMED"
            ? { status, confirmedById: admin.id, confirmedAt: now, cancelledAt: null, ...(note !== undefined ? { note: note || null } : {}) }
            : { status, cancelledAt: now, ...(note !== undefined ? { note: note || null } : {}) },
      });
      await syncUserPaymentStatus(tx, payment.userId);
      await this.audit.log(
        admin,
        ip,
        { action: status === "CONFIRMED" ? "payment.confirmed" : "payment.cancelled", entityType: "payment", entityId: paymentId, before, after: payment },
        tx,
      );
      return payment;
    });
  }
}

/** Ism, familiya yoki telefon bo'yicha qidiruv. */
export function userSearch(q: string): Prisma.UserWhereInput {
  const term = q.trim();
  const digits = term.replace(/\D/g, "");
  const or: Prisma.UserWhereInput[] = [
    { firstName: { contains: term, mode: "insensitive" } },
    { lastName: { contains: term, mode: "insensitive" } },
  ];
  if (digits.length >= 3) or.push({ phone: { contains: digits } });
  const [first, ...rest] = term.split(/\s+/);
  if (rest.length) {
    or.push({ AND: [{ firstName: { contains: first, mode: "insensitive" } }, { lastName: { contains: rest.join(" "), mode: "insensitive" } }] });
  }
  return { OR: or };
}
