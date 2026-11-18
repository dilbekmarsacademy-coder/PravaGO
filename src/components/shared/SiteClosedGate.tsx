"use client";

// Admin saytni shu foydalanuvchi uchun yopgan (backend 403 SITE_CLOSED): butun
// ekranni egallagan sahifa — "Adminga yozish" Telegram'ga (yangi oynada).
// Ikki yo'l bilan ochiladi: (1) har qanday API so'rovi SITE_CLOSED olsa —
// `notifySiteClosed()` hodisasi; (2) sahifa ochilganda token bo'lsa — bitta
// yengil `/auth/check`. Admin panelda ishlamaydi (u alohida sessiya).

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LockKeyholeIcon, RotateCcwIcon, SendIcon } from "lucide-react";
import { ADMIN_TELEGRAM_URL } from "@/config/business";
import { currentSessionToken } from "@/lib/api/session";
import { SITE_CLOSED_EVENT, clearSiteClosed, detectSiteClosed, isSiteClosed } from "@/lib/api/site-closed";
import { useLocale } from "@/lib/i18n/useLocale";
import { Button, buttonClasses } from "@/components/shared/Button";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Sessiya hali yopiqmi: true — yopiq, false — ochiq yoki aniqlab bo'lmadi (yangi sessiya yaratilmaydi). */
async function probe(): Promise<boolean> {
  const token = currentSessionToken();
  if (!token || !API_BASE_URL) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/check`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    return await detectSiteClosed(res);
  } catch {
    return false;
  }
}

export default function SiteClosedGate() {
  const pathname = usePathname();
  const enabled = !pathname.startsWith("/admin");
  const { t } = useLocale();
  const [closed, setClosed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stillClosed, setStillClosed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const onClosed = () => setClosed(true);
    window.addEventListener(SITE_CLOSED_EVENT, onClosed);
    if (isSiteClosed()) onClosed();
    else void probe();
    return () => window.removeEventListener(SITE_CLOSED_EVENT, onClosed);
  }, [enabled]);

  useEffect(() => {
    if (!closed) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [closed]);

  const recheck = useCallback(async () => {
    setChecking(true);
    setStillClosed(false);
    const still = await probe();
    setChecking(false);
    if (still) {
      setStillClosed(true);
      return;
    }
    // Admin ochgan — sahifa toza holatda qayta yuklanadi.
    clearSiteClosed();
    window.location.reload();
  }, []);

  if (!enabled || !closed) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="site-closed-title"
      aria-describedby="site-closed-desc"
      data-testid="site-closed"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background px-4 py-10"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-danger/15 text-danger">
          <LockKeyholeIcon className="size-7" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 id="site-closed-title" className="font-display text-2xl font-bold text-balance text-foreground">
            {t.siteClosed.title}
          </h1>
          <p id="site-closed-desc" className="text-base text-muted-foreground">
            {t.siteClosed.desc}
          </p>
        </div>
        <a
          href={ADMIN_TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          autoFocus
          data-testid="site-closed-contact"
          className={buttonClasses({ variant: "primary", size: "lg", className: "w-full sm:w-auto" })}
        >
          <SendIcon className="size-4.5" aria-hidden="true" />
          {t.siteClosed.contact}
        </a>
        <Button variant="ghost" size="sm" onClick={recheck} disabled={checking}>
          <RotateCcwIcon className={checking ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
          {t.siteClosed.recheck}
        </Button>
        {stillClosed && (
          <p role="status" className="text-xs text-muted-foreground">
            {t.siteClosed.stillClosed}
          </p>
        )}
      </div>
    </div>
  );
}
