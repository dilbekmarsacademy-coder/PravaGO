import type { ExamStatus } from "@/components/home/types";

export interface CategoryPriceInfo {
  categoryNumber: 1 | 2 | 3;
  label: string;
  amount: number;
}

// TODO: rasmiy narxlar belgilangach shu qiymatlar (amount) haqiqiysi bilan almashtiriladi.
export const CATEGORY_PRICES: Record<ExamStatus, CategoryPriceInfo> = {
  "failed-before": { categoryNumber: 1, label: "Ilgari yiqilgan", amount: 400_000 },
  "first-time": { categoryNumber: 2, label: "Birinchi marta", amount: 350_000 },
  "license-revoked": { categoryNumber: 3, label: "Pravasi bekor qilingan", amount: 450_000 },
};

export const COURSE_NAME = "PravaTayyor — 7 kunlik tayyorgarlik kursi";

export const COURSE_FEATURES = [
  "6 kunlik video darslar + kalit so'zlar PDF",
  "Mavzu testlari",
  "63 ta bilet",
  "7-kun yakuniy imtihon",
];

export function formatSom(amount: number): string {
  const grouped = amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} so'm`;
}
