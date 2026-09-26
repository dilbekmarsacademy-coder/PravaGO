"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, XIcon } from "lucide-react";
import { buttonClasses } from "@/components/shared/Button";
import { useLocale } from "@/lib/i18n/useLocale";

interface MobileNavBarProps {
  currentIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onOpenSheet: () => void;
}

/** Telefonda pastki sticky panel: [‹ Oldingi] [3 / 32 ▾] [Keyingi ›]. */
export function MobileNavBar({ currentIndex, total, onPrev, onNext, onOpenSheet }: MobileNavBarProps) {
  const { t } = useLocale();

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/85 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button
          type="button"
          className={buttonClasses({ variant: "secondary", size: "md", className: "justify-self-start px-4" })}
          disabled={currentIndex === 0}
          onClick={onPrev}
        >
          <ChevronLeftIcon className="size-4" />
          {t.testSession.prev}
        </button>
        <button
          type="button"
          onClick={onOpenSheet}
          aria-label={t.testSession.openNavigator}
          aria-haspopup="dialog"
          className={buttonClasses({ variant: "ghost", size: "md", className: "font-mono whitespace-nowrap tabular-nums text-foreground" })}
        >
          {currentIndex + 1} / {total}
          <ChevronUpIcon className="size-4" />
        </button>
        <button
          type="button"
          className={buttonClasses({ variant: "secondary", size: "md", className: "justify-self-end px-4" })}
          disabled={currentIndex >= total - 1}
          onClick={onNext}
        >
          {t.testSession.next}
          <ChevronRightIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Pastdan chiqadigan panel (telefon). Tashqariga bosish, ESC yoki pastga surish bilan yopiladi. */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const { t } = useLocale();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <motion.div
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-3xl border-t border-border bg-popover px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-card"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 500) onClose();
            }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-foreground/20" aria-hidden="true" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-foreground">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.testSession.close}
                className={buttonClasses({ variant: "ghost", size: "icon" })}
              >
                <XIcon className="size-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
