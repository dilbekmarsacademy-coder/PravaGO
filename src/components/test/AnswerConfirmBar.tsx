"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { useLocale } from "@/lib/i18n/useLocale";

interface AnswerConfirmBarProps {
  /** Tanlangan variant belgisi (F2) — null bo'lsa panel yashirin. */
  label: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Javobni tasdiqlash paneli (snackbar): variant tanlangach "Qabul qilaymi?" — "Ha" bosilgandagina
 * javob tekshiriladi. Telefonda pastki navigatsiya ustida, kompyuterda pastki o'rtada.
 * Enter — "Ha", Escape — "Yo'q" (TestSession klaviatura ishlovchisida).
 */
export function AnswerConfirmBar({
  label,
  onConfirm,
  onCancel,
}: AnswerConfirmBarProps) {
  const { t } = useLocale();
  return (
    <AnimatePresence>
      {label && (
        <motion.div
          key="answer-confirm"
          role="dialog"
          aria-live="polite"
          aria-label={t.testSession.confirmAnswerPrompt(label)}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-lg flex-wrap items-center gap-3 rounded-2xl border border-border-strong bg-popover/95 px-4 py-3 shadow-card backdrop-blur-xl md:bottom-6"
          data-testid="answer-confirm"
        >
          <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">
            {t.testSession.confirmAnswerPrompt(label)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onCancel}
              data-testid="answer-confirm-no"
            >
              <XIcon className="size-4" />
              {t.testSession.confirmAnswerNo}
            </Button>
            <Button
              size="sm"
              onClick={onConfirm}
              data-testid="answer-confirm-yes"
            >
              <CheckIcon className="size-4" />
              {t.testSession.confirmAnswerYes}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
