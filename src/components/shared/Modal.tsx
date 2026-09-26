"use client";

import type { ReactNode } from "react";
import { XIcon } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/lib/i18n/useLocale";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}

/** Yagona modal uslubi (ro'yxatdan o'tish modali bilan bir xil sirt). */
export function Modal({ open, onOpenChange, title, description, icon, children }: ModalProps) {
  const { t } = useLocale();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-2rem)] max-w-md gap-0 rounded-2xl border border-border bg-popover/90 p-6 text-card-foreground shadow-card backdrop-blur-2xl sm:max-w-md sm:p-7"
      >
        <DialogClose
          render={
            <button
              type="button"
              className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-border bg-background/50 text-muted-foreground transition-colors outline-none hover:border-brand/50 hover:text-brand focus-visible:ring-2 focus-visible:ring-brand"
            />
          }
        >
          <XIcon className="size-4" />
          <span className="sr-only">{t.registerModal.yopish}</span>
        </DialogClose>

        {icon && <div className="mb-4">{icon}</div>}
        <DialogTitle className="pr-10 font-display text-lg font-bold text-foreground">{title}</DialogTitle>
        {description && (
          <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </DialogDescription>
        )}
        {children && <div className="mt-6">{children}</div>}
      </DialogContent>
    </Dialog>
  );
}
