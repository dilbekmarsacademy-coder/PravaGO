import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { Order, OrderStatus, Prisma, Tariff } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { paymeCheckoutUrl, paymentsAvailableFor } from "./payme/payme.config";
import { PaymeService } from "./payme/payme.service";
import { ONLINE_TARIFFS, TARIFF_IDS, toTiyin } from "./tariffs";

type Tx = Prisma.TransactionClient;
const DAY_MS = 86_400_000;
/** To'lovi boshlanmagan shu tarifdagi yangi buyurtma qayta ishlatiladi. */
const REUSE_MS = 3600_000;

// Provayderdan mustaqil: Payme, keyin Click/Uzum ham shu funksiyalarni o'z DB tranzaksiyasi ichida chaqiradi.

/** Buyurtma qatorini qulflab o'qiydi (parallel so'rovlar navbatga turadi). */
export async function lockOrder(tx: Tx, id: string): Promise<Order | null> {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
  return tx.order.findUnique({ where: { id } });
}

/** Buyurtma qulflangan va PENDING bo'lishi shart. */
export async function markOrderPaid(tx: Tx, order: Order, now: Date): Promise<void> {
  await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: now } });
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${order.userId} FOR UPDATE`;
  await tx.subscription.create({
    data: { userId: order.userId, orderId: order.id, tariff: order.tariff, durationDays: order.durationDays, activatedAt: now, startsAt: now, endsAt: now },
  });
  await replaySubscriptions(tx, order.userId);
}

/** Bekor qilish; to'langan bo'lsa obunasi olib tashlanadi. */
export async function cancelOrder(tx: Tx, order: Order, now: Date): Promise<void> {
  await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelledAt: now } });
  if (order.status !== "PAID") return;
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${order.userId} FOR UPDATE`;
  await tx.subscription.updateMany({ where: { orderId: order.id, revokedAt: null }, data: { revokedAt: now } });
  await replaySubscriptions(tx, order.userId);
}

/** Obunalarni faollashgan tartibda ketma-ket ulaydi: har biri oldingisi tugagach (yoki to'langan paytdan) boshlanadi. */
async function replaySubscriptions(tx: Tx, userId: string): Promise<void> {
  const rows = await tx.subscription.findMany({ where: { userId, revokedAt: null }, orderBy: [{ activatedAt: "asc" }, { id: "asc" }] });
  let end = 0;
  for (const s of rows) {
    const start = Math.max(s.activatedAt.getTime(), end);
    end = start + s.durationDays * DAY_MS;
    await tx.subscription.update({ where: { id: s.id }, data: { startsAt: new Date(start), endsAt: new Date(end) } });
  }
  await tx.user.update({
    where: { id: userId },
    data: { subscriptionUntil: rows.length ? new Date(end) : null, subscriptionTariff: rows.at(-1)?.tariff ?? null },
  });
}

export interface OrderDto {
  id: string;
  tariff: Tariff;
  /** tiyin */
  amount: number;
  status: OrderStatus;
  createdAt: Date;
  paidAt: Date | null;
}

function toDto(o: Order): OrderDto {
  return { id: o.id, tariff: o.tariff, amount: o.amount, status: o.status, createdAt: o.createdAt, paidAt: o.paidAt };
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payme: PaymeService,
  ) {}

  tariffs(userId: string | undefined) {
    return { enabled: paymentsAvailableFor(userId), tariffs: TARIFF_IDS.map((id) => ({ id, ...ONLINE_TARIFFS[id] })) };
  }

  async create(userId: string, tariff: Tariff): Promise<OrderDto & { checkoutUrl: string }> {
    if (!paymentsAvailableFor(userId)) {
      throw new ServiceUnavailableException({ statusCode: 503, code: "PAYMENTS_DISABLED", message: "Onlayn to'lov hozircha o'chiq" });
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.type === "CENTER") {
      throw new ConflictException({ statusCode: 409, code: "CENTER_ACCOUNT", message: "Markaz o'quvchisiga onlayn to'lov kerak emas" });
    }
    if (!user.registeredAt) throw new BadRequestException({ statusCode: 400, code: "NOT_REGISTERED", message: "Avval ro'yxatdan o'ting" });
    // Admin tasdiqlagan to'lov — muddatsiz kirish; ortiqcha pul olinmasin.
    if (user.paymentStatus === "PAID") throw new ConflictException({ statusCode: 409, code: "ALREADY_PAID", message: "Kurs allaqachon ochiq" });

    const { price, durationDays } = ONLINE_TARIFFS[tariff];
    const amount = toTiyin(price);
    const reusable = await this.prisma.order.findFirst({
      where: { userId, provider: "PAYME", tariff, amount, durationDays, status: "PENDING", createdAt: { gt: new Date(Date.now() - REUSE_MS) }, paymeTransactions: { none: {} } },
      orderBy: { createdAt: "desc" },
    });
    const order = reusable ?? (await this.prisma.order.create({ data: { userId, provider: "PAYME", tariff, amount, durationDays } }));
    return { ...toDto(order), checkoutUrl: paymeCheckoutUrl(order) };
  }

  /** Faqat egasiga; begona buyurtma ham 404. */
  async get(userId: string, id: string): Promise<OrderDto> {
    const find = () => this.prisma.order.findFirst({ where: { id, userId } });
    let order = await find();
    if (order?.status === "PENDING") {
      await this.payme.expireForOrder(id);
      order = await find();
    }
    if (!order) throw new NotFoundException("Buyurtma topilmadi");
    return toDto(order);
  }
}
