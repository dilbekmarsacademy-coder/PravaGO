// Oylik AI budjeti (AI_MONTHLY_BUDGET_USD): 80% da ogohlantirish, 100% da yangi
// AI chaqiruvlari (importlar, xulosalar) to'xtaydi — mavjud kesh ko'rsatilaveradi.

import type { PrismaService } from "../prisma/prisma.service";

export const BUDGET_WARN_RATIO = 0.8;
/** Toshkent vaqti (UTC+5) bo'yicha oy boshlanishi. */
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;

export function monthlyBudgetUsd(): number {
  const value = Number(process.env.AI_MONTHLY_BUDGET_USD);
  return Number.isFinite(value) && value > 0 ? value : 5;
}

export function monthStart(now = Date.now()): Date {
  const local = new Date(now + TZ_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - TZ_OFFSET_MS);
}

export type BudgetLevel = "ok" | "warn" | "blocked";

export interface BudgetState {
  budgetUsd: number;
  spentUsd: number;
  level: BudgetLevel;
  /** 0..1+ */
  ratio: number;
}

export function budgetLevel(spentUsd: number, budgetUsd: number): BudgetLevel {
  if (spentUsd >= budgetUsd) return "blocked";
  if (spentUsd >= budgetUsd * BUDGET_WARN_RATIO) return "warn";
  return "ok";
}

export async function budgetState(prisma: PrismaService, now = Date.now()): Promise<BudgetState> {
  const agg = await prisma.aiUsage.aggregate({ where: { createdAt: { gte: monthStart(now) } }, _sum: { costUsd: true } });
  const spentUsd = agg._sum.costUsd ?? 0;
  const budgetUsd = monthlyBudgetUsd();
  return { budgetUsd, spentUsd, level: budgetLevel(spentUsd, budgetUsd), ratio: budgetUsd ? spentUsd / budgetUsd : 0 };
}
