// Admin API javob turlari (backend/src/admin/* bilan mos).

export type UserPaymentStatus = "NONE" | "PENDING" | "PAID";
export type PaymentStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export interface UserProgress {
  percent: number;
  passedTopics: number;
  totalTopics: number;
  passedDays: number[];
}

export interface AdminUserRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  examStatus: string | null;
  registeredAt: string | null;
  lastActiveAt: string | null;
  paymentStatus: UserPaymentStatus;
  active: boolean;
  progress: UserProgress;
}

export interface Paged<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface AdminPayment {
  id: string;
  userId: string;
  amount: number;
  status: PaymentStatus;
  method: string;
  note: string | null;
  userNote: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  user?: { id: string; firstName: string | null; lastName: string | null; phone: string | null; examStatus: string | null };
  confirmedBy?: { login: string; name: string } | null;
  createdBy?: { login: string; name: string } | null;
}

export const EXAM_STATUS_LABEL: Record<string, string> = {
  "first-time": "Birinchi marta",
  "failed-before": "Ilgari yiqilgan",
  "license-revoked": "Pravasi bekor qilingan",
};

export const USER_PAYMENT_LABEL: Record<UserPaymentStatus, string> = { PAID: "To'lagan", PENDING: "Kutilmoqda", NONE: "To'lamagan" };
export const PAYMENT_LABEL: Record<PaymentStatus, string> = { PENDING: "Kutilmoqda", CONFIRMED: "Tasdiqlangan", CANCELLED: "Bekor qilingan" };

export function fullName(u: { firstName: string | null; lastName: string | null }): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
}
