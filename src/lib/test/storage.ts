"use client";

// Test sahifasi uchun brauzer xotirasi: joriy sessiya (sahifa yangilansa ham
// javoblar saqlanadi) va xatchoplar. Xotira mavjud bo'lmasa (shaxsiy oyna va
// h.k.) jimgina ishlamaydi — test oddiy tarzda davom etadi.

import { useCallback, useSyncExternalStore } from "react";
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

// ---- Xatchoplar (localStorage, mavzu bo'yicha savol id'lari) ----

const bookmarkListeners = new Set<() => void>();

function readBookmarksRaw(slug: string): string {
  try {
    return localStorage.getItem(bookmarksKey(slug)) ?? "[]";
  } catch {
    return "[]";
  }
}

export function useBookmarks(slug: string): { bookmarks: Set<string>; toggle: (questionId: string) => void } {
  const raw = useSyncExternalStore(
    (listener) => {
      bookmarkListeners.add(listener);
      return () => bookmarkListeners.delete(listener);
    },
    () => readBookmarksRaw(slug),
    () => "[]",
  );

  let ids: string[] = [];
  try {
    ids = JSON.parse(raw) as string[];
  } catch {
    ids = [];
  }
  const bookmarks = new Set(ids);

  const toggle = useCallback(
    (questionId: string) => {
      const current = new Set(JSON.parse(readBookmarksRaw(slug)) as string[]);
      if (current.has(questionId)) current.delete(questionId);
      else current.add(questionId);
      try {
        localStorage.setItem(bookmarksKey(slug), JSON.stringify([...current]));
      } catch {
        // ignore
      }
      bookmarkListeners.forEach((listener) => listener());
    },
    [slug],
  );

  return { bookmarks, toggle };
}
