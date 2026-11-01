"use client";

// Test tugagach ekran o'rtasidagi oyna: natija va keyingi qadam.
// O'tilgan bo'lsa — "Keyingi mavzuga o'tish" (kun oxirida — "Keyingi kunga
// o'tish") yoki "Kabinetga qaytish"; o'tilmagan bo'lsa — natijani ko'rish.

import Link from "next/link";
import { ArrowRightIcon, HomeIcon, PartyPopperIcon, TargetIcon } from "lucide-react";
import { buttonClasses, Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { PASS_PERCENT } from "@/config/rules";
import { useLocale } from "@/lib/i18n/useLocale";

interface CompletionModalProps {
  open: boolean;
  correct: number;
  total: number;
  /** Shu mavzu kunning oxirgi mavzusi (o'tilgan bo'lsa — "kunni yakunladingiz"). */
  dayNumber: number | null;
  lastOfDay: boolean;
  /** Keyingi mavzu sahifasi (video); bo'lmasa — faqat kabinet. */
  nextHref: string | null;
  onClose: () => void;
}

export function CompletionModal({ open, correct, total, dayNumber, lastOfDay, nextHref, onClose }: CompletionModalProps) {
  const { t } = useLocale();
  const labels = t.testSession;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = percent >= PASS_PERCENT;
  const title = !passed ? labels.notPassedTitle : lastOfDay && dayNumber ? labels.dayCompleteTitle(dayNumber) : labels.completeTitle;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      icon={
        <span className={passed ? "flex size-12 items-center justify-center rounded-full bg-success/15 text-success" : "flex size-12 items-center justify-center rounded-full bg-brand/15 text-brand"}>
          {passed ? <PartyPopperIcon className="size-5" /> : <TargetIcon className="size-5" />}
        </span>
      }
      title={<span data-testid="completion-title">{title}</span>}
      description={
        <>
          <span className="block font-mono font-semibold text-foreground tabular-nums" data-testid="completion-result">
            {labels.completeResult(correct, total, percent)}
          </span>
          {!passed && <span className="mt-1 block">{labels.notPassedDesc(PASS_PERCENT)}</span>}
        </>
      }
    >
      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <Link href="/kabinet" className={buttonClasses({ variant: "secondary", size: "md" })} data-testid="completion-kabinet">
          <HomeIcon className="size-4" />
          {t.kabinet.backToKabinet}
        </Link>
        {passed && nextHref ? (
          <Link href={nextHref} className={buttonClasses({ variant: "primary", size: "md" })} data-testid="completion-next">
            {lastOfDay ? labels.nextDay : labels.nextTopic}
            <ArrowRightIcon className="size-4" />
          </Link>
        ) : (
          <Button variant="primary" size="md" onClick={onClose} data-testid="completion-results">
            {labels.viewResults}
          </Button>
        )}
      </div>
    </Modal>
  );
}
