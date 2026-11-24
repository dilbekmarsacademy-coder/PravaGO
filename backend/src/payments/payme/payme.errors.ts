export type PaymeMessage = { uz: string; ru: string; en: string };

/** JSON-RPC xatosi: HTTP 200 bilan `error` maydonida qaytadi. */
export class PaymeError extends Error {
  constructor(
    readonly code: number,
    readonly text: PaymeMessage,
    readonly data?: string,
  ) {
    super(text.en);
  }
}

const m = (uz: string, ru: string, en: string): PaymeMessage => ({ uz, ru, en });

export const paymeErrors = {
  parse: () => new PaymeError(-32700, m("JSON o'qib bo'lmadi", "Ошибка парсинга JSON", "Parse error")),
  invalidRequest: (field?: string) => new PaymeError(-32600, m("So'rov noto'g'ri", "Неверный запрос", "Invalid request"), field),
  methodNotFound: (name: string) => new PaymeError(-32601, m("Metod topilmadi", "Метод не найден", "Method not found"), name),
  unauthorized: () => new PaymeError(-32504, m("Ruxsat yo'q", "Недостаточно привилегий", "Insufficient privileges")),
  internal: () => new PaymeError(-32400, m("Ichki xatolik", "Внутренняя ошибка", "Internal error")),
  wrongAmount: () => new PaymeError(-31001, m("Summa noto'g'ri", "Неверная сумма", "Wrong amount")),
  transactionNotFound: () => new PaymeError(-31003, m("Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found")),
  cannotPerform: () => new PaymeError(-31008, m("Amalni bajarib bo'lmaydi", "Невозможно выполнить операцию", "Unable to perform operation")),
  orderNotFound: () => new PaymeError(-31050, m("Buyurtma topilmadi", "Заказ не найден", "Order not found"), "order_id"),
  orderUnavailable: () => new PaymeError(-31099, m("Buyurtma to'langan, bekor qilingan yoki to'lovda", "Заказ оплачен, отменён или в процессе оплаты", "Order is paid, cancelled or being paid"), "order_id"),
};
