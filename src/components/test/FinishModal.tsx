"use client";

import { FlagIcon } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { useLocale } from "@/lib/i18n/useLocale";
import { formatClock } from "@/lib/test/timer";

interface FinishModalProps {
  open: boolean;
  unanswered: number;
  /** Qolgan vaqt (soniya). */
  remainingSec: number;
  /** Hozirgacha to'g'ri javoblar va jami savollar — foiz natija ekranidagi kabi (to'g'ri / jami). */
  correct: number;
  total: number;
  onContinue: () => void;
  onFinish: () => void;
}

export function FinishModal({ open, unanswered, remainingSec, correct, total, onContinue, onFinish }: FinishModalProps) {
  const { t } = useLocale();
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onContinue();
      }}
      icon={
        <span className="flex size-12 items-center justify-center rounded-full bg-brand/15 text-brand">
          <FlagIcon className="size-5" />
        </span>
      }
      title={t.testSession.finishModalTitle}
      description={
        unanswered > 0 ? t.testSession.finishModalUnanswered(unanswered) : t.testSession.finishModalAllAnswered
      }
    >
      <dl className="mb-5 grid grid-cols-2 gap-2.5" data-testid="finish-summary">
        <div className="rounded-xl border border-border bg-foreground/[0.03] px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">{t.testSession.finishModalRemaining}</dt>
          <dd className="mt-0.5 font-mono text-lg font-bold text-foreground tabular-nums" data-testid="finish-remaining">
            {formatClock(remainingSec)}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-foreground/[0.03] px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">{t.testSession.finishModalResult}</dt>
          <dd className="mt-0.5 font-mono text-sm font-bold text-foreground tabular-nums" data-testid="finish-result">
            {t.testSession.finishModalResultValue(correct, total, percent)}
          </dd>
        </div>
      </dl>
      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="md" onClick={onFinish} data-testid="finish-confirm">
          {t.testSession.finishConfirm}
        </Button>
        <Button variant="primary" size="md" onClick={onContinue} autoFocus>
          {t.testSession.continueTest}
        </Button>
      </div>
    </Modal>
  );
}
