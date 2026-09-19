"use client";

import { useState } from "react";
import { DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

interface OfferStepProps {
  stepLabel: string;
  onAccept: () => void;
}

export default function OfferStep({ stepLabel, onAccept }: OfferStepProps) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs tracking-[0.24em] text-neon-orange uppercase">
          {stepLabel}
        </span>
        <DialogTitle className="mt-1 font-display text-2xl font-bold text-foreground">
          Ommaviy oferta shartlari
        </DialogTitle>
      </div>

      <div className="h-48 overflow-y-auto rounded-xl border border-border bg-white/[0.03] p-4 text-sm leading-relaxed text-muted-foreground">
        {/* TODO: real oferta matni bilan almashtiriladi */}
        <p className="mb-3">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ushbu
          hujjat PravaTayyor platformasidan foydalanish shartlarini
          belgilaydi. Foydalanuvchi ro&rsquo;yxatdan o&rsquo;tish orqali quyida
          keltirilgan shartlarga rozilik bildiradi.
        </p>
        <p className="mb-3">
          Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
          nisi ut aliquip ex ea commodo consequat.
        </p>
        <p className="mb-3">
          Duis aute irure dolor in reprehenderit in voluptate velit esse
          cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
          cupidatat non proident, sunt in culpa qui officia deserunt mollit
          anim id est laborum.
        </p>
        <p>
          Platforma xizmatlaridan foydalanish, to&rsquo;lov shartlari va
          shaxsiy ma&rsquo;lumotlarni qayta ishlash tartibi ushbu oferta bilan
          tartibga solinadi.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground/90">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => setChecked(value === true)}
          className="mt-0.5"
        />
        <span>Men ommaviy oferta shartlari bilan tanishdim va roziman</span>
      </label>

      <Button
        type="button"
        disabled={!checked}
        onClick={onAccept}
        className="glow-orange-hover h-auto self-start rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 py-2.5 text-sm font-bold text-background"
      >
        Davom etish
      </Button>
    </div>
  );
}
