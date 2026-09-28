"use client";

// Test sahifasi uchun brauzer xotirasi: joriy sessiya (sahifa yangilansa ham
// javoblar saqlanadi). Xotira mavjud bo'lmasa (shaxsiy oyna va
// h.k.) jimgina ishlamaydi — test oddiy tarzda davom etadi.

import type { CheckAnswerResult } from "@/lib/api/test";

export interface StoredAnswer {
  selectedOptionId: string | null;
  result: CheckAnswerResult | null;
}

export interface StoredSession {
  v: 1;
  questionIds: string[];
  answers: Record<number, StoredAnswer>;
  currentIndex: number;
  startedAt: number;
}

const sessionKey = (slug: string) => `pt_test_session:${slug}`;
const bookmarksKey = (slug: string) => `pt_bookmarks:${slug}`;

export function loadSession(slug: string, questionIds: string[]): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(slug));
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    const sameQuestions =
      session.v === 1 &&
      session.questionIds.length === questionIds.length &&
      session.questionIds.every((id, i) => id === questionIds[i]);
    return sameQuestions ? session : null;
  } catch {
    return null;
  }
}

export function saveSession(slug: string, session: StoredSession): void {
  try {
    sessionStorage.setItem(sessionKey(slug), JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearSession(slug: string): void {
  try {
    sessionStorage.removeItem(sessionKey(slug));
  } catch {
    // ignore
  }
}

// ---- Eski xatchoplar ----
// Avval xatchoplar faqat brauzerda (localStorage) saqlanardi; endi — serverda
// ("Saqlanganlar"). Eski ro'yxat bir marta o'qiladi va o'chiriladi.

export function takeLegacyBookmarks(slug: string): string[] {
  try {
    const raw = localStorage.getItem(bookmarksKey(slug));
    if (raw === null) return [];
    localStorage.removeItem(bookmarksKey(slug));
    const ids = JSON.parse(raw) as unknown;
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
