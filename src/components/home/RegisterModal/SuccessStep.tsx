"use client";

import { useEffect } from "react";
import { CheckIcon } from "lucide-react";
import { DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/lib/i18n/useLocale";

const AUTO_ADVANCE_MS = 1400;

interface SuccessStepProps {
  onDone: () => void;
}

export default function SuccessStep({ onDone }: SuccessStepProps) {
  const { t } = useLocale();

  useEffect(() => {
    const timer = setTimeout(onDone, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <span className="glow-orange flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 text-background">
        <CheckIcon className="size-7" strokeWidth={2.5} />
      </span>

      <div>
        <DialogTitle className="font-display text-2xl font-bold text-foreground">
          {t.registerModal.success.title}
        </DialogTitle>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {t.registerModal.success.desc}
        </p>
      </div>
    </div>
  );
}
