"use client";

import { useEffect } from "react";
import { RotateCwIcon } from "lucide-react";
import { Button } from "@/components/shared/Button";

// Admin sahifasida kutilmagan xato — oq ekran o'rniga xabar va qayta yuklash.
export default function AdminError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-xl font-bold">Sahifani ko&apos;rsatib bo&apos;lmadi</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Brauzer tarjimasi yoki kengaytmasi yoqilgan bo&apos;lsa, uni shu sayt uchun o&apos;chirib, sahifani qayta yuklang.
      </p>
      <Button type="button" onClick={() => window.location.reload()}>
        <RotateCwIcon className="size-4" /> Qayta yuklash
      </Button>
    </main>
  );
}
