"use client";

// Ro'yxatdan o'tish ma'lumotlarining klientdagi nusxasi (Bosh sahifa → /tolov →
// /kabinet). Asl manba — backend (GET /me): `syncAccount()` holatni serverdan
// oladi, avvalgi versiyada faqat shu yerda saqlangan ro'yxatni esa bir marta
// jim tarzda backend'ga ko'chiradi.

import { useSyncExternalStore } from "react";
import type { ExamStatus } from "@/components/home/types";
import type { Locale } from "@/lib/i18n/dictionary";
import { getMe, registerAccount, saveLanguage, type Me } from "@/lib/api/account";

export type AccountStatus = "pending" | "active";

export interface RegistrationRecord {
  firstName: string;
  lastName: string;
  age: string;
  phone: string;
  examStatus: ExamStatus;
  status: AccountStatus;
  /** Foydalanuvchi tanlagan til — keyingi kirishda shu til ochiladi. */
  preferredLanguage?: Locale;
  /** Backend'da ham bor (yangi ro'yxat yoki ko'chirilgan). */
  synced?: boolean;
}

const STORAGE_KEY = "pt_registration";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

function parse(raw: string | null): RegistrationRecord | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RegistrationRecord;
  } catch {
    return null;
  }
}

/** Reaktiv bo'lmagan, bir martalik o'qish — effekt/hodisa handlerlarida ishlatiladi. */
export function getRegistration(): RegistrationRecord | null {
  return parse(getSnapshot());
}

function write(record: RegistrationRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage mavjud bo'lmasa (masalan, shaxsiy oynada) e'tiborsiz qoldiramiz.
  }
  listeners.forEach((listener) => listener());
}

export function saveRegistration(data: Omit<RegistrationRecord, "status" | "synced">, options?: { synced?: boolean }): void {
  write({ ...data, status: "pending", synced: options?.synced ?? false });
}

let syncing: Promise<Me> | null = null;

/**
 * Holatni serverdan oladi va klient nusxasini yangilaydi (status: kirish
 * huquqi bo'lsa "active"). Ro'yxat faqat brauzerda bo'lsa (eski versiya) —
 * bir marta backend'ga ko'chiriladi; progress shu qurilma sessiyasida qoladi.
 */
export function syncAccount(): Promise<Me> {
  syncing ??= (async () => {
    const local = getRegistration();
    let me = await getMe();
    if (!me.registered && local && !local.synced) {
      try {
        me = await registerAccount({ ...local, legacyStatus: local.status });
      } catch {
        // Masalan, raqam boshqa akkauntda — klient nusxasi o'zgarmaydi, /tolov sababini ko'rsatadi.
        return me;
      }
    }
    if (me.registered && me.profile) {
      write({
        firstName: me.profile.firstName,
        lastName: me.profile.lastName,
        age: me.profile.age !== null ? String(me.profile.age) : (local?.age ?? ""),
        phone: local?.phone ?? "",
        examStatus: me.profile.examStatus ?? local?.examStatus ?? "first-time",
        preferredLanguage: me.profile.preferredLanguage ?? local?.preferredLanguage,
        status: me.access ? "active" : "pending",
        synced: true,
      });
    }
    return me;
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

export function markAccountActive(): RegistrationRecord | null {
  const current = getRegistration();
  if (!current) return null;
  const next: RegistrationRecord = { ...current, status: "active" };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener());
  return next;
}

/** Joriy profilga tanlangan tilni yozadi (profil bo'lmasa — hech narsa qilmaydi). */
export function savePreferredLanguage(locale: Locale): void {
  const current = getRegistration();
  if (!current || current.preferredLanguage === locale) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, preferredLanguage: locale }));
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener());
  if (current.synced) saveLanguage(locale).catch(() => undefined);
}

/** Reaktiv o'qish — komponent render vaqtida joriy ro'yxatdan o'tish holatini oladi. */
export function useRegistration(): RegistrationRecord | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return parse(raw);
}

/** Chiqish — joriy (mock) sessiyani tozalaydi. */
export function clearRegistration(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener());
}
