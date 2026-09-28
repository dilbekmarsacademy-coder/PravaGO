"use client";

// Saqlash/olib tashlash + foydalanuvchiga xabar (toast). Test sahifasi va
// "Saqlanganlar" sahifasi bir xil xulq-atvorga ega bo'lishi uchun shu yerda.

import { ApiError } from "@/lib/api/session";
import { updateSavedNote } from "@/lib/api/saved";
import type { Dictionary } from "@/lib/i18n";
import { dismissToast, showToast } from "@/components/shared/Toast";
import { getSavedState, setSaved, type SetSavedOptions } from "./store";

export const SAVED_PAGE_HREF = "/kabinet/saqlanganlar";

export interface SavedFeedbackHooks {
  /** Olib tashlashda — "Bekor qilish" izohni ham tiklashi uchun. */
  note?: string | null;
  /** "Bekor qilish" bosilganda (sahifa kartani joyiga qaytaradi). */
  onUndo?: () => void;
  /** Server xato berib holat orqaga qaytganda. */
  onRollback?: () => void;
}

function errorMessage(error: unknown, t: Dictionary): string {
  const limit = getSavedState().count?.limit ?? 1000;
  return error instanceof ApiError && error.code === "SAVED_LIMIT_REACHED" ? t.saved.toast.limit(limit) : t.saved.toast.error;
}

/**
 * Holatni darhol o'zgartiradi (optimistic) va toast ko'rsatadi:
 * saqlanganda — "Ko'rish" havolasi, olib tashlanganda — "Bekor qilish".
 * Server xato bersa holat orqaga qaytadi va xato toast chiqadi.
 */
export function setSavedWithFeedback(
  questionId: string,
  saved: boolean,
  options: SetSavedOptions,
  t: Dictionary,
  hooks: SavedFeedbackHooks = {},
): Promise<void> {
  const toastId = saved
    ? showToast({ message: t.saved.toast.saved, action: { label: t.saved.toast.view, href: SAVED_PAGE_HREF } })
    : showToast({
        message: t.saved.toast.removed,
        tone: "info",
        action: {
          label: t.saved.toast.undo,
          onClick: () => {
            hooks.onUndo?.();
            const note = hooks.note;
            setSaved(questionId, true, options)
              .then(() => (note ? updateSavedNote(questionId, note).then(() => undefined) : undefined))
              .catch((error: unknown) => {
                showToast({ message: errorMessage(error, t), tone: "danger" });
              });
          },
        },
      });

  return setSaved(questionId, saved, options).catch((error: unknown) => {
    dismissToast(toastId);
    showToast({ message: errorMessage(error, t), tone: "danger" });
    hooks.onRollback?.();
  });
}

export function toggleSavedWithFeedback(questionId: string, options: SetSavedOptions, t: Dictionary): Promise<void> {
  return setSavedWithFeedback(questionId, !getSavedState().ids.has(questionId), options, t);
}
