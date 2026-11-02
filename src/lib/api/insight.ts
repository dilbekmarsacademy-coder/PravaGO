// Kabinet: "Mening tahlilim" — statistika bazadan, AI xulosa kuniga ko'pi bilan bir marta.

import type { Locale } from "@/lib/i18n";
import { authFetch } from "./session";

export interface InsightTopic {
  slug: string;
  day?: number;
  title: string;
  bestPercent?: number;
  attempts?: number;
  wrong?: number;
}

export interface StudentInsight {
  stats: {
    attempts: number;
    lastAttemptAt: string | null;
    topics: { total: number; attempted: number; passed: number };
    averagePercent: number;
    recentAveragePercent: number;
    answers: { total: number; correct: number; percent: number };
    weakTopics: InsightTopic[];
    strongTopics: InsightTopic[];
    mostWrongTopics: InsightTopic[];
  };
  insight: { summary: string; tips: string[]; locale: string; createdAt: string } | null;
  aiConfigured: boolean;
  canRefresh: boolean;
  nextRefreshAt: string | null;
}

export function getInsight(locale: Locale): Promise<StudentInsight> {
  return authFetch<StudentInsight>(`/me/insight?locale=${locale}`);
}

export function refreshInsight(locale: Locale): Promise<StudentInsight> {
  return authFetch<StudentInsight>(`/me/insight?locale=${locale}`, { method: "POST" });
}
