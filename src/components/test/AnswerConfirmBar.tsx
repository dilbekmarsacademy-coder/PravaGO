"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { useLocale } from "@/lib/i18n/useLocale";

interface AnswerConfirmBarProps {
  /** Tanlangan variant: belgisi (F2) va to'liq matni — null bo'lsa oyna yashirin. */
  choice: { label: string; text: string } | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Javobni tasdiqlash oynasi — ekran o'rtasida: variant tanlangach qaysi javob
 * tanlangani (belgi + to'liq matn) va "Qabul qilaymi?" — "Ha" bosilgandagina
 * javob tekshiriladi. Fon bosilsa — "Yo'q". Enter — "Ha", Escape — "Yo'q"
 * (TestSession klaviatura ishlovchisida; shuning uchun aria-modal qo'yilmaydi).
 */
export function AnswerConfirmBar({ choice, onConfirm, onCancel }: AnswerConfirmBarProps) {
  const { t } = useLocale();
  return (
    <AnimatePresence>
      {choice && (
        <motion.div
          key="answer-confirm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-background/60 px-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) onCancel();
          }}
        >
          <motion.div
            role="alertdialog"
            aria-labelledby="answer-confirm-title"
            aria-describedby="answer-confirm-choice"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border-strong bg-popover p-5 shadow-card sm:p-6"
            data-testid="answer-confirm"
          >
            <p id="answer-confirm-title" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t.testSession.confirmAnswerTitle}
            </p>
            <div
              id="answer-confirm-choice"
              className="flex items-stretch overflow-hidden rounded-2xl border border-brand bg-brand/10"
            >
              <span className="flex w-12 shrink-0 items-center justify-center bg-brand font-mono text-sm font-bold text-brand-foreground sm:w-14">
                {choice.label}
              </span>
              <span
                className="flex flex-1 items-center px-4 py-3 text-base leading-snug font-medium break-words text-foreground"
                data-testid="answer-confirm-text"
              >
                {choice.text}
              </span>
            </div>
            <p className="font-display text-base font-bold text-foreground">{t.testSession.confirmAnswerQuestion}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="md" onClick={onCancel} data-testid="answer-confirm-no">
                <XIcon className="size-4" />
                {t.testSession.confirmAnswerNo}
              </Button>
              <Button size="md" onClick={onConfirm} autoFocus data-testid="answer-confirm-yes">
                <CheckIcon className="size-4" />
                {t.testSession.confirmAnswerYes}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
