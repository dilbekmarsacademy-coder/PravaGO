"use client";

import { useState } from "react";
import { DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import RetroButton from "./RetroButton";

interface OfferStepProps {
  onAccept: () => void;
}

export default function OfferStep({ onAccept }: OfferStepProps) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-stop">
          Bosqich 1/4
        </span>
        <DialogTitle className="mt-1 font-display text-3xl uppercase tracking-wide text-ink">
          Ommaviy oferta shartlari
        </DialogTitle>
      </div>

      <div className="h-48 overflow-y-auto border-2 border-ink/70 bg-ink/[0.03] p-4 text-sm leading-relaxed text-ink/80">
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

      <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => setChecked(value === true)}
          className="mt-0.5 border-ink/60 data-checked:border-ink data-checked:bg-stop"
        />
        <span>
          Men ommaviy oferta shartlari bilan tanishdim va roziman
        </span>
      </label>

      <RetroButton
        type="button"
        surface="paper"
        disabled={!checked}
        onClick={onAccept}
        className="self-start"
      >
        Davom etish
      </RetroButton>
    </div>
  );
}
