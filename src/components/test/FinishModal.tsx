"use client";

import { FlagIcon } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { useLocale } from "@/lib/i18n/useLocale";

interface FinishModalProps {
  open: boolean;
  unanswered: number;
  onContinue: () => void;
  onFinish: () => void;
}

export function FinishModal({ open, unanswered, onContinue, onFinish }: FinishModalProps) {
  const { t } = useLocale();

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
      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="md" onClick={onFinish}>
          {t.testSession.finishShort}
        </Button>
        <Button variant="primary" size="md" onClick={onContinue} autoFocus>
          {t.testSession.continueTest}
        </Button>
      </div>
    </Modal>
  );
}
