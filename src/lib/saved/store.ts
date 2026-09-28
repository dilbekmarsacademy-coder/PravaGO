"use client";

// Saqlanganlar uchun umumiy klient holati: saqlangan savol id'lari va soni.
// Test sahifasi, kabinet header'idagi badge va "Saqlanganlar" sahifasi shu
// bitta do'kondan o'qiydi — saqlash/o'chirishdan keyin hammasi darhol yangilanadi.
//
// O'zgartirishlar optimistic: holat darhol o'zgaradi, server xato bersa orqaga
// qaytadi. Bitta savol bo'yicha so'rovlar navbat bilan yuboriladi (tez-tez
// bosilganda POST/DELETE tartibi aralashib ketmasligi uchun).

import { useSyncExternalStore } from "react";
import {
  getSavedCount,
  getSavedIds,
  saveQuestion,
  unsaveQuestion,
  type SavedCount,
  type SavedSourceMode,
} from "@/lib/api/saved";

type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface SavedState {
  ids: ReadonlySet<string>;
  idsStatus: LoadStatus;
  count: SavedCount | null;
  countStatus: LoadStatus;
  /** Har bir muvaffaqiyatli o'zgarishda oshadi — ro'yxatlar qayta yuklanishi uchun. */
  revision: number;
}

const INITIAL: SavedState = {
  ids: new Set(),
  idsStatus: "idle",
  count: null,
  countStatus: "idle",
  revision: 0,
};

let state: SavedState = INITIAL;
const listeners = new Set<() => void>();
const queues = new Map<string, Promise<unknown>>();

function setState(patch: Partial<SavedState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSavedState(): SavedState {
  return state;
}

export function useSavedState(): SavedState {
  return useSyncExternalStore(subscribe, getSavedState, () => INITIAL);
}

export async function loadSavedIds(options?: { force?: boolean }): Promise<void> {
  if (!options?.force && (state.idsStatus === "loading" || state.idsStatus === "ready")) return;
  setState({ idsStatus: "loading" });
  try {
    const ids = await getSavedIds();
    setState({ ids: new Set(ids), idsStatus: "ready" });
  } catch {
    setState({ idsStatus: "error" });
  }
}

export async function loadSavedCount(options?: { force?: boolean }): Promise<void> {
  if (!options?.force && (state.countStatus === "loading" || state.countStatus === "ready")) return;
  setState({ countStatus: "loading" });
  try {
    setState({ count: await getSavedCount(), countStatus: "ready" });
  } catch {
    setState({ countStatus: "error" });
  }
}

function applyLocal(questionId: string, topicSlug: string, saved: boolean) {
  const ids = new Set(state.ids);
  if (saved) ids.add(questionId);
  else ids.delete(questionId);

  let count = state.count;
  if (count) {
    const delta = saved ? 1 : -1;
    const exists = count.byTopic.some((g) => g.topicSlug === topicSlug);
    const byTopic = (
      exists
        ? count.byTopic.map((g) => (g.topicSlug === topicSlug ? { ...g, count: g.count + delta } : g))
        : saved
          ? [...count.byTopic, { topicSlug, count: 1 }]
          : count.byTopic
    ).filter((g) => g.count > 0);
    count = { ...count, total: Math.max(0, count.total + delta), byTopic };
  }
  setState({ ids, count });
}

export interface SetSavedOptions {
  topicSlug: string;
  sourceMode?: SavedSourceMode;
  attemptId?: string;
}

/**
 * Savolni saqlaydi (`saved=true`) yoki olib tashlaydi. Holat darhol o'zgaradi;
 * server xato bersa orqaga qaytariladi va xato qayta otiladi (chaqiruvchi toast chiqaradi).
 */
export function setSaved(questionId: string, saved: boolean, options: SetSavedOptions): Promise<void> {
  const wasSaved = state.ids.has(questionId);
  if (wasSaved !== saved) applyLocal(questionId, options.topicSlug, saved);

  const previous = queues.get(questionId) ?? Promise.resolve();
  const run = previous
    .catch(() => undefined)
    .then((): Promise<unknown> =>
      saved
        ? saveQuestion(questionId, options.sourceMode ?? "practice", options.attemptId)
        : unsaveQuestion(questionId),
    )
    .then(
      () => setState({ revision: state.revision + 1 }),
      (error: unknown) => {
        // Faqat hozirgi holat hali shu amalniki bo'lsa orqaga qaytaramiz.
        if (state.ids.has(questionId) === saved && wasSaved !== saved) {
          applyLocal(questionId, options.topicSlug, wasSaved);
        }
        throw error;
      },
    );
  queues.set(questionId, run);
  run.finally(() => {
    if (queues.get(questionId) === run) queues.delete(questionId);
  }).catch(() => undefined);
  return run;
}

export function toggleSaved(questionId: string, options: SetSavedOptions): { saved: boolean; done: Promise<void> } {
  const saved = !state.ids.has(questionId);
  return { saved, done: setSaved(questionId, saved, options) };
}

/** Chiqishda — boshqa foydalanuvchiga oldingi holat ko'rinmasligi uchun. */
export function resetSavedStore(): void {
  queues.clear();
  state = INITIAL;
  listeners.forEach((listener) => listener());
}
