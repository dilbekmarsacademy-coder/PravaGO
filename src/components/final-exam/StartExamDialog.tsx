"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlagIcon, TimerIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EXAM_TYPE_LABEL,
  FINAL_EXAM_ACTIVE,
  FINAL_EXAM_LOCKED,
  FINAL_EXAM_NO_ATTEMPTS,
  FINAL_EXAM_NOT_ENOUGH,
  formatPercent,
  startFinalExam,
  type FinalExamOverview,
  type FinalExamType,
} from "@/lib/api/final-exam";
import { ApiError } from "@/lib/api/session";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";

/** "Imtihonni boshlash": 20 talik / 50 talik tanlash — har birining o'z urinishlar hisoblagichi. */
export function StartExamDialog({ open, onOpenChange, overview }: { open: boolean; onOpenChange: (open: boolean) => void; overview: FinalExamOverview }) {
  const router = useRouter();
  const [selected, setSelected] = useState<FinalExamType>(() => overview.types.find((t) => t.attemptsLeft > 0 || t.active)?.type ?? "Q20");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const type = overview.types.find((t) => t.type === selected)!;

  async function start() {
    if (type.active) {
      router.push(`/test/imtihon/${type.active.id}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const state = await startFinalExam(selected);
      router.push(`/test/imtihon/${state.id}`);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.code === FINAL_EXAM_ACTIVE && typeof err.details?.attemptId === "string") {
        router.push(`/test/imtihon/${err.details.attemptId}`);
      } else if (err instanceof ApiError && err.code === FINAL_EXAM_NO_ATTEMPTS) {
        setError("Bu tur uchun 10 ta urinish tugagan.");
      } else if (err instanceof ApiError && err.code === FINAL_EXAM_LOCKED) {
        setError("Avval 1–6-kunlarning barcha mavzularini tugating.");
      } else if (err instanceof ApiError && err.code === FINAL_EXAM_NOT_ENOUGH) {
        setError("Savollar bazasi hali tayyor emas. Keyinroq urinib ko'ring.");
      } else {
        setError("Imtihonni boshlab bo'lmadi. Internet aloqasini tekshirib, qayta urinib ko'ring.");
      }
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      icon={
        <span className="glow-orange flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-background">
          <FlagIcon className="size-5" />
        </span>
      }
      title="Yakuniy ichki imtihon"
      description="Turini tanlang. Har bir tur uchun alohida 10 ta urinish beriladi; o'tish uchun 10 ta urinishning o'rtachasi kamida 98% bo'lishi kerak."
    >
      <div role="radiogroup" aria-label="Imtihon turi" className="mb-4 grid gap-2.5">
        {overview.types.map((t) => {
          const disabled = t.attemptsLeft === 0 && !t.active;
          return (
            <button
              key={t.type}
              type="button"
              role="radio"
              aria-checked={selected === t.type}
              disabled={disabled}
              onClick={() => setSelected(t.type)}
              data-testid={`exam-type-${t.type}`}
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                selected === t.type ? "border-brand bg-brand/10" : "border-border bg-foreground/[0.02] hover:border-brand/50",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span>
                <span className="block font-display text-base font-bold text-foreground">{EXAM_TYPE_LABEL[t.type]}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TimerIcon className="size-3.5" />
                  {t.questions} ta savol · {t.minutes} daqiqa
                </span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-sm font-bold text-foreground tabular-nums">
                  Urinishlar: {t.attemptsUsed}/{t.maxAttempts}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.active ? "Tugallanmagan urinish bor" : t.average !== null ? `O'rtacha: ${formatPercent(t.average)}` : "Hali topshirilmagan"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mb-5 text-xs leading-relaxed text-muted-foreground">
        Boshlangan urinish to&apos;xtatilmaydi: vaqt serverda hisoblanadi, sahifa yopilsa ham davom etadi. Vaqt tugasa, javob berilmagan savollar xato hisoblanadi.
      </p>
      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-foreground">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="md" onClick={() => onOpenChange(false)}>
          Bekor qilish
        </Button>
        <Button size="md" onClick={start} disabled={busy || (type.attemptsLeft === 0 && !type.active)} data-testid="exam-start-confirm">
          {type.active ? "Davom ettirish" : `${EXAM_TYPE_LABEL[selected]}ni boshlash`}
        </Button>
      </div>
    </Modal>
  );
}
