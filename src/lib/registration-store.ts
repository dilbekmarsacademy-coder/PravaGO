"use client";

// Ro'yxatdan o'tish ma'lumotlarini sahifalar orasida (Bosh sahifa → /tolov →
// /kabinet) uzatish uchun yengil klient-side "do'kon". Backend tayyor bo'lgach
// bu joyni real sessiya/API chaqiruvi bilan almashtirish kerak bo'ladi.

import { useSyncExternalStore } from "react";
import type { ExamStatus } from "@/components/home/types";

export type AccountStatus = "pending" | "active";

export interface RegistrationRecord {
  firstName: string;
  lastName: string;
  age: string;
  phone: string;
  examStatus: ExamStatus;
  status: AccountStatus;
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

export function saveRegistration(data: Omit<RegistrationRecord, "status">): void {
  const record: RegistrationRecord = { ...data, status: "pending" };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage mavjud bo'lmasa (masalan, shaxsiy oynada) e'tiborsiz qoldiramiz.
  }
  listeners.forEach((listener) => listener());
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
