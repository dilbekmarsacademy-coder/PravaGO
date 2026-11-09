"use client";

import { useState } from "react";
import Link from "next/link";
import { DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { GraduationCapIcon } from "lucide-react";
import { useLocale } from "@/lib/i18n/useLocale";

interface OfferStepProps {
  stepLabel: string;
  onAccept: () => void;
  onCenterLogin?: () => void;
}

export default function OfferStep({ stepLabel, onAccept, onCenterLogin }: OfferStepProps) {
  const [checked, setChecked] = useState(false);
  const { t } = useLocale();
  const consent = t.registerModal.offer.consent;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs tracking-[0.24em] text-neon-orange uppercase">
          {stepLabel}
        </span>
        <DialogTitle className="mt-1 font-display text-2xl font-bold text-foreground">
          {t.registerModal.offer.title}
        </DialogTitle>
      </div>

      <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-foreground/[0.03] p-4 text-sm leading-relaxed text-muted-foreground">
        <p className="mb-2">{t.registerModal.offer.intro}</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          {t.registerModal.offer.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>

      {/* Mavjud foydalanuvchilardan qayta so'ralmaydi.
          TODO(to'lov): onlayn to'lovdan oldin ham oferta va qaytarish siyosatiga rozilik so'ralsin. */}
      <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground/90">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => setChecked(value === true)}
          className="mt-0.5"
          data-testid="register-consent"
        />
        <span>
          {consent.pre}
          <Link href="/oferta" target="_blank" className="font-semibold text-neon-orange underline-offset-2 hover:underline">
            {consent.offer}
          </Link>
          {consent.mid}
          <Link href="/maxfiylik" target="_blank" className="font-semibold text-neon-orange underline-offset-2 hover:underline">
            {consent.privacy}
          </Link>
          {consent.post}
        </span>
      </label>

      <Button
        type="button"
        disabled={!checked}
        onClick={onAccept}
        className="glow-orange-hover h-auto self-start rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 py-2.5 text-sm font-bold text-background"
      >
        {t.registerModal.offer.cta}
      </Button>

      {onCenterLogin && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <span className="text-xs text-muted-foreground">{t.centerLogin.buttonHint}</span>
          <button
            type="button"
            onClick={onCenterLogin}
            data-testid="center-login-open-modal"
            className="inline-flex items-center gap-2 self-start rounded-full border border-neon-cyan/40 px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:border-neon-cyan hover:text-neon-cyan"
          >
            <GraduationCapIcon className="size-4 text-neon-cyan" />
            {t.centerLogin.button}
          </button>
        </div>
      )}
    </div>
  );
}
