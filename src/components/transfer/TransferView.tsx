"use client";

import { useEffect } from "react";
import { Loader2Icon } from "lucide-react";
import { exchangeTransferCode } from "@/lib/api/transfer";
import { setCenterSessionToken, setSessionToken } from "@/lib/api/session";
import { useLocale } from "@/lib/i18n/useLocale";
import { clearRegistration, syncAccount } from "@/lib/registration-store";
import { TRANSFER_PATH, safeNextPath } from "@/lib/transfer";

/** Bosh sahifa shu belgini ko'rsa — "Qaytadan kiring" xabari (bir marta). */
export const TRANSFER_FAILED_KEY = "pt_transfer_failed";

// Kod bir marta ishlaydi — React (dev) effektni ikki marta chaqirsa ham bitta so'rov.
let started = false;

export function TransferView() {
  const { t } = useLocale();

  useEffect(() => {
    if (started) return;
    started = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const next = safeNextPath(params.get("next"));
    // Kod tarixda, keyingi sahifalarning Referer'ida va skrinshotlarda qolmasin.
    window.history.replaceState(null, "", TRANSFER_PATH);

    const fail = () => {
      try {
        sessionStorage.setItem(TRANSFER_FAILED_KEY, "1");
      } catch {
        // ignore
      }
      window.location.replace("/");
    };
    if (!code) return fail();

    exchangeTransferCode(code)
      .then(async ({ token, center }) => {
        clearRegistration();
        if (center) setCenterSessionToken(token);
        else setSessionToken(token);
        // Profil (ism, til, to'lov holati) serverdan — klient nusxasi qayta yoziladi.
        await syncAccount().catch(() => undefined);
        window.location.replace(next);
      })
      .catch(fail);
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center" aria-busy="true">
      <Loader2Icon className="size-6 animate-spin text-amber-400" aria-hidden="true" />
      <p className="text-sm font-medium text-muted-foreground" role="status">
        {t.transfer.loading}
      </p>
    </main>
  );
}
