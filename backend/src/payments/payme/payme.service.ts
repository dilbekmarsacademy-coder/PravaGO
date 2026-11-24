import { Injectable, Logger } from "@nestjs/common";
import { Prisma, type Order, type PaymeTransaction } from "@prisma/client";
import { createHash, timingSafeEqual } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { addsAccess } from "../tariffs";
import { cancelOrder, lockOrder, markOrderPaid } from "../orders.service";
import { paymeKey } from "./payme.config";
import { PaymeError, paymeErrors } from "./payme.errors";

type Tx = Prisma.TransactionClient;
type Params = Record<string, unknown>;

/** Bajarilmagan tranzaksiya shundan keyin bekor bo'ladi (Payme: 43 200 000 ms). */
export const PAYME_TIMEOUT_MS = 12 * 3600_000;
const REASON_TIMEOUT = 4;
export const STATE = { CREATED: 1, PERFORMED: 2, CANCELLED: -1, REFUNDED: -2 } as const;

/** Sana (Date) chegarasi: undan katta son bilan Prisma/Postgres BigInt xatosi bo'lmasin. */
const MAX_TIME = 8.64e15;

function str(params: Params, key: string): string {
  const v = params[key];
  if (typeof v !== "string" || !v || v.length > 64 || v.includes("\0")) throw paymeErrors.invalidRequest(key);
  return v;
}

function int(params: Params, key: string): number {
  const v = params[key];
  if (typeof v !== "number" || !Number.isInteger(v) || Math.abs(v) > MAX_TIME) throw paymeErrors.invalidRequest(key);
  return v;
}

function orderIdOf(params: Params): string {
  const account = params.account;
  const id = account && typeof account === "object" ? (account as Params).order_id : undefined;
  if (typeof id !== "string" || !id || id.length > 64 || id.includes("\0")) throw paymeErrors.orderNotFound();
  return id;
}

function isExpired(t: PaymeTransaction): boolean {
  return t.state === STATE.CREATED && Date.now() - Number(t.createTime) > PAYME_TIMEOUT_MS;
}

@Injectable()
export class PaymeService {
  private readonly log = new Logger("Payme");

  constructor(private readonly prisma: PrismaService) {}

  async handle(authorization: string | undefined, body: unknown) {
    const req = (body && typeof body === "object" && !Array.isArray(body) ? body : null) as Params | null;
    const id = typeof req?.id === "number" || typeof req?.id === "string" ? req.id : null;
    let reply: { jsonrpc: "2.0"; id: number | string | null; result?: unknown; error?: unknown };
    try {
      if (!this.authorized(authorization)) throw paymeErrors.unauthorized();
      if (body === undefined) throw paymeErrors.parse();
      if (!req || typeof req.method !== "string") throw paymeErrors.invalidRequest("method");
      if (!req.params || typeof req.params !== "object") throw paymeErrors.invalidRequest("params");
      reply = { jsonrpc: "2.0", id, result: await this.dispatch(req.method, req.params as Params) };
    } catch (err) {
      const e = err instanceof PaymeError ? err : paymeErrors.internal();
      if (e !== err) this.log.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
      reply = { jsonrpc: "2.0", id, error: { code: e.code, message: e.text, ...(e.data ? { data: e.data } : {}) } };
    }
    // Sarlavhalar (kalit) hech qachon yozilmaydi; tana JSON — log qatorini soxtalashtirib bo'lmaydi.
    const { method, params } = req ?? {};
    this.log.log(`${JSON.stringify({ id, method, params }).slice(0, 2000)} -> ${JSON.stringify({ result: reply.result, error: reply.error }).slice(0, 2000)}`);
    return reply;
  }

  private authorized(header: string | undefined): boolean {
    const key = paymeKey();
    const match = /^Basic\s+(\S+)$/i.exec(header ?? "");
    if (!key || !match) return false;
    const hash = (s: string) => createHash("sha256").update(s).digest();
    return timingSafeEqual(hash(Buffer.from(match[1], "base64").toString("utf8")), hash(`Paycom:${key}`));
  }

  private dispatch(method: string, params: Params): Promise<unknown> {
    switch (method) {
      case "CheckPerformTransaction":
        return this.checkPerform(params);
      case "CreateTransaction":
        return this.create(params);
      case "PerformTransaction":
        return this.perform(params);
      case "CancelTransaction":
        return this.cancel(params);
      case "CheckTransaction":
        return this.check(params);
      case "GetStatement":
        return this.statement(params);
      default:
        throw paymeErrors.methodNotFound(method.slice(0, 64));
    }
  }

  private async checkPerform(params: Params) {
    await this.prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, orderIdOf(params));
      await this.assertPayable(tx, order, params.amount);
    });
    return { allow: true };
  }

  private async create(params: Params) {
    const paymeId = str(params, "id");
    const time = int(params, "time");
    const orderId = orderIdOf(params);
    try {
      return await this.createLocked(paymeId, time, orderId, params.amount);
    } catch (err) {
      // Bir xil paymeId turli buyurtma bilan bir vaqtda — natija mavjud yozuvdan.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return this.createLocked(paymeId, time, orderId, params.amount);
      throw err;
    }
  }

  private async createLocked(paymeId: string, time: number, orderId: string, amount: unknown) {
    const outcome = await this.prisma.$transaction(async (tx): Promise<PaymeTransaction | PaymeError> => {
      // Takroriy so'rov: yozuv qaysi buyurtmaniki bo'lsa, o'sha qulflanadi.
      const known = await tx.paymeTransaction.findUnique({ where: { paymeId } });
      const order = await lockOrder(tx, known?.orderId ?? orderId);
      const existing = await tx.paymeTransaction.findUnique({ where: { paymeId } });
      if (existing) {
        if (existing.state !== STATE.CREATED) return paymeErrors.cannotPerform();
        if (await this.expire(tx, existing)) return paymeErrors.cannotPerform();
        return existing;
      }
      await this.assertPayable(tx, order, amount);
      if (Date.now() - time > PAYME_TIMEOUT_MS) return paymeErrors.cannotPerform();
      return tx.paymeTransaction.create({
        data: { paymeId, orderId: order!.id, amount: order!.amount, state: STATE.CREATED, paymeTime: BigInt(time), createTime: BigInt(Date.now()) },
      });
    });
    if (outcome instanceof PaymeError) throw outcome;
    return { create_time: Number(outcome.createTime), transaction: outcome.id, state: outcome.state };
  }

  private async perform(params: Params) {
    // Xato tranzaksiya ICHIDA otilmaydi: timeout bo'yicha bekor qilish saqlanishi kerak.
    const outcome = await this.withTransaction(params, async (tx, t, order) => {
      if (t.state === STATE.PERFORMED) return t;
      if (t.state !== STATE.CREATED || (await this.expire(tx, t)) || order.status !== "PENDING") return paymeErrors.cannotPerform();
      const now = new Date();
      await markOrderPaid(tx, order, now);
      return tx.paymeTransaction.update({ where: { id: t.id }, data: { state: STATE.PERFORMED, performTime: BigInt(now.getTime()) } });
    });
    return { transaction: outcome.id, perform_time: Number(outcome.performTime), state: outcome.state };
  }

  private async cancel(params: Params) {
    const reason = int(params, "reason");
    if (Math.abs(reason) > 1000) throw paymeErrors.invalidRequest("reason");
    const outcome = await this.withTransaction(params, async (tx, t, order) => {
      if (t.state < 0) return t;
      return this.cancelIn(tx, t, order, reason);
    });
    return { transaction: outcome.id, cancel_time: Number(outcome.cancelTime), state: outcome.state };
  }

  private async check(params: Params) {
    const t = await this.prisma.paymeTransaction.findUnique({ where: { paymeId: str(params, "id") } });
    if (!t) throw paymeErrors.transactionNotFound();
    return {
      create_time: Number(t.createTime),
      perform_time: Number(t.performTime),
      cancel_time: Number(t.cancelTime),
      transaction: t.id,
      state: t.state,
      reason: t.reason,
    };
  }

  private async statement(params: Params) {
    const from = int(params, "from");
    const to = int(params, "to");
    const rows = await this.prisma.paymeTransaction.findMany({
      where: { paymeTime: { gte: BigInt(from), lte: BigInt(to) } },
      orderBy: { paymeTime: "asc" },
    });
    return {
      transactions: rows.map((t) => ({
        id: t.paymeId,
        time: Number(t.paymeTime),
        amount: t.amount,
        account: { order_id: t.orderId },
        create_time: Number(t.createTime),
        perform_time: Number(t.performTime),
        cancel_time: Number(t.cancelTime),
        transaction: t.id,
        state: t.state,
        reason: t.reason,
      })),
    };
  }

  /** Buyurtma to'lovga tayyormi. Muddati o'tgan tranzaksiyasi bor buyurtma ham band hisoblanadi. */
  private async assertPayable(tx: Tx, order: Order | null, amount: unknown): Promise<void> {
    if (!order) throw paymeErrors.orderNotFound();
    if (amount !== order.amount) throw paymeErrors.wrongAmount();
    if (order.status !== "PENDING") throw paymeErrors.orderUnavailable();
    // Buyurtma ochiq turganda foydalanuvchi boshqa to'lov bilan shu (yoki yuqori) kirishni olgan bo'lsa.
    if (!addsAccess(await tx.user.findUniqueOrThrow({ where: { id: order.userId } }), order.tariff)) throw paymeErrors.orderUnavailable();
    if (await tx.paymeTransaction.count({ where: { orderId: order.id, state: { in: [STATE.CREATED, STATE.PERFORMED] } } })) throw paymeErrors.orderUnavailable();
  }

  /** Buyurtma qulfi ostida tranzaksiyani o'zgartiradi; qaytgan PaymeError commit'dan KEYIN otiladi. */
  private async withTransaction(params: Params, fn: (tx: Tx, t: PaymeTransaction, order: Order) => Promise<PaymeTransaction | PaymeError>): Promise<PaymeTransaction> {
    const paymeId = str(params, "id");
    const outcome = await this.prisma.$transaction(async (tx) => {
      const found = await tx.paymeTransaction.findUnique({ where: { paymeId } });
      if (!found) return paymeErrors.transactionNotFound();
      const order = await lockOrder(tx, found.orderId);
      // Qulfdan keyin qayta o'qiladi — parallel so'rov o'zgartirgan bo'lishi mumkin.
      const t = await tx.paymeTransaction.findUniqueOrThrow({ where: { paymeId } });
      return fn(tx, t, order!);
    });
    if (outcome instanceof PaymeError) throw outcome;
    return outcome;
  }

  private async expire(tx: Tx, t: PaymeTransaction): Promise<boolean> {
    if (!isExpired(t)) return false;
    await this.cancelIn(tx, t, await tx.order.findUniqueOrThrow({ where: { id: t.orderId } }), REASON_TIMEOUT);
    return true;
  }

  private async cancelIn(tx: Tx, t: PaymeTransaction, order: Order, reason: number): Promise<PaymeTransaction> {
    const now = new Date();
    await cancelOrder(tx, order, now);
    return tx.paymeTransaction.update({
      where: { id: t.id },
      data: { state: t.state === STATE.PERFORMED ? STATE.REFUNDED : STATE.CANCELLED, reason, cancelTime: BigInt(now.getTime()) },
    });
  }

  /** Buyurtma holati so'ralganda: 12 soatdan oshgan tranzaksiyani bekor qiladi. */
  async expireForOrder(orderId: string): Promise<void> {
    const stale = await this.prisma.paymeTransaction.findFirst({ where: { orderId, state: STATE.CREATED, createTime: { lt: BigInt(Date.now() - PAYME_TIMEOUT_MS) } } });
    if (!stale) return;
    await this.prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      await this.expire(tx, await tx.paymeTransaction.findUniqueOrThrow({ where: { id: stale.id } }));
    });
  }
}
