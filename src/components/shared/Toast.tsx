"use client";

// Yagona toast (qisqa xabar) — kabinet va test sahifasi uchun. Tashqi
// kutubxonasiz: modul darajasidagi do'kon + <Toaster />, root layout'da bir
// marta joylashtirilgan. Sahifalar orasida o'tganda ham xabar yo'qolmaydi.

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2Icon, InfoIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";

export type ToastTone = "success" | "info" | "danger";

export type ToastAction = { label: string; href: string } | { label: string; onClick: () => void };

export interface ToastInput {
  message: ReactNode;
  tone?: ToastTone;
  action?: ToastAction;
  /** ms; sukut bo'yicha 5 s (amalli xabarlar — 6 s). */
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

// Bir vaqtda bitta xabar: yangisi eskisining o'rnini egallaydi — tez-tez
// bosilganda (masalan, ketma-ket saqlash) telefonda javoblar yopilib qolmaydi.
const MAX_VISIBLE = 1;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: ToastItem[] = [];

function emit() {
  listeners.forEach((listener) => listener());
}

export function showToast(input: ToastInput): number {
  const id = nextId++;
  toasts = [...toasts, { ...input, id }].slice(-MAX_VISIBLE);
  emit();
  return id;
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const TONE_ICON = {
  success: CheckCircle2Icon,
  info: InfoIcon,
  danger: TriangleAlertIcon,
} satisfies Record<ToastTone, unknown>;

const TONE_CLASS: Record<ToastTone, string> = {
  success: "text-success",
  info: "text-brand",
  danger: "text-danger",
};

export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);

  return (
    // Telefonda pastki navigatsiya paneli ustida, desktopda pastki o'ng burchakda.
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:right-6 md:bottom-6 md:left-auto md:items-end md:px-0"
    >
      <AnimatePresence initial={false}>
        {items.map((toast) => (
          <ToastView key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastView({ toast }: { toast: ToastItem }) {
  const { t } = useLocale();
  const tone = toast.tone ?? "success";
  const Icon = TONE_ICON[tone];
  const duration = toast.duration ?? (toast.action ? 6000 : 5000);

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration]);

  const actionClass =
    "flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-bold text-brand outline-none transition-colors hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand";

  return (
    <motion.div
      layout
      role={tone === "danger" ? "alert" : "status"}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl border border-border bg-popover/95 py-1.5 pr-1.5 pl-4 shadow-card backdrop-blur-xl md:w-auto md:min-w-80"
    >
      <Icon className={cn("size-4.5 shrink-0", TONE_CLASS[tone])} aria-hidden="true" />
      <p className="min-w-0 flex-1 py-2 text-sm font-medium text-foreground">{toast.message}</p>
      {toast.action &&
        ("href" in toast.action ? (
          <Link href={toast.action.href} onClick={() => dismissToast(toast.id)} className={actionClass}>
            {toast.action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              dismissToast(toast.id);
              (toast.action as { onClick: () => void }).onClick();
            }}
            className={actionClass}
          >
            {toast.action.label}
          </button>
        ))}
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        aria-label={t.saved.toast.dismiss}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand"
      >
        <XIcon className="size-4" />
      </button>
    </motion.div>
  );
}
