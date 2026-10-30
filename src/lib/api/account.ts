// Foydalanuvchi akkaunti: ro'yxatdan o'tish, to'lov holati va kirish huquqi.
// Kirish huquqi faqat backend'da hisoblanadi — bu yerda faqat natija o'qiladi.

import type { ExamStatus } from "@/components/home/types";
import type { Locale } from "@/lib/i18n/dictionary";
import { authFetch } from "./session";

export type PaymentState = "NONE" | "PENDING" | "PAID";

export interface Me {
  registered: boolean;
  profile: { firstName: string; lastName: string; age: number | null; examStatus: ExamStatus | null; preferredLanguage: Locale | null } | null;
  payment: { status: PaymentState; amount: number; pendingSince: string | null };
  access: boolean;
  paymentRequired: boolean;
  /** "CENTER" — o'quv markaz o'quvchisi (login + parol, bitta faol qurilma). */
  type?: "SELF" | "CENTER";
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  age: string;
  phone: string;
  examStatus: ExamStatus;
  preferredLanguage?: Locale;
  /** Faqat eski (localStorage) ro'yxatni bir martalik ko'chirishda. */
  legacyStatus?: "pending" | "active";
}

export function getMe(): Promise<Me> {
  return authFetch<Me>("/me");
}

export function registerAccount(input: RegisterInput): Promise<Me> {
  return authFetch<Me>("/me/register", {
    method: "POST",
    body: JSON.stringify({
      firstName: input.firstName,
      lastName: input.lastName,
      age: Number(input.age),
      phone: input.phone,
      examStatus: input.examStatus,
      ...(input.preferredLanguage ? { preferredLanguage: input.preferredLanguage } : {}),
      ...(input.legacyStatus ? { legacyStatus: input.legacyStatus } : {}),
    }),
  });
}

export function saveLanguage(preferredLanguage: Locale): Promise<void> {
  return authFetch<void>("/me/language", { method: "PUT", body: JSON.stringify({ preferredLanguage }) });
}

export interface MyPayment {
  id: string;
  amount: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  createdAt: string;
  confirmedAt: string | null;
}

export function requestPayment(note?: string): Promise<MyPayment> {
  return authFetch<MyPayment>("/payments/request", { method: "POST", body: JSON.stringify(note ? { note } : {}) });
}
