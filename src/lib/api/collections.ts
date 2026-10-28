// "Yangi testlar" — admin qo'shgan to'plamlar (faqat nashr qilinganlari, to'lov qilganlar uchun).
// Savollar oddiy test API orqali (`/topics/<slug>/questions`) — to'g'ri javobsiz.

import type { LocalizedText } from "@/lib/i18n/localized";
import { authFetch } from "./session";

export interface CollectionSummary {
  slug: string;
  title: LocalizedText;
  questionCount: number;
  attempts: number;
  bestPercent: number | null;
  passed: boolean;
}

export function listCollections(): Promise<CollectionSummary[]> {
  return authFetch<CollectionSummary[]>("/collections");
}

export function isCollectionSlug(slug: string): boolean {
  return slug.startsWith("new-");
}
