"use client";

// "Sayt ko'chdi" sahifasi: 5 soniyalik sanash, so'ng yangi domenga. Tizimga
// kirgan foydalanuvchi bir martalik kod bilan o'tadi (qayta kirish shart emas),
// qolganlar — yangi domendagi o'sha sahifaga.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CheckCircle2Icon, GaugeIcon, ShieldCheckIcon } from "lucide-react";
import { buttonClasses } from "@/components/shared/Button";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";
import { requestTransferCode } from "@/lib/api/transfer";
import { hasSessionToken, isCenterSession } from "@/lib/api/session";
import { useLocale } from "@/lib/i18n/useLocale";
import { getRegistration, syncAccount } from "@/lib/registration-store";
import { plainTarget, transferTarget } from "@/lib/transfer";

const COUNTDOWN_SEC = 5;
/** Kod 60 s amal qiladi — shundan eski bo'lsa, o'tishdan oldin yangisi olinadi. */
const CODE_MAX_AGE_MS = 40_000;
/** Ko'rsatish uchun (o'tish manzili — transfer.ts'dagi NEW_SITE_URL). */
const DISPLAY_DOMAIN = "pravaishonch.uz";

export function MovedView({ oldPath }: { oldPath: string }) {
  const { t } = useLocale();
  const [seconds, setSeconds] = useState(COUNTDOWN_SEC);
  const [signedIn, setSignedIn] = useState(false);
  const code = useRef<{ value: string; at: number } | null>(null);
  const leaving = useRef(false);

  const fetchCode = useCallback(async () => {
    const value = await requestTransferCode();
    code.current = value ? { value, at: Date.now() } : null;
    return code.current;
  }, []);

  useEffect(() => {
    const active = hasSessionToken() && (getRegistration() !== null || isCenterSession());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage faqat brauzerda
    setSignedIn(active);
    if (!active) return;
    // Faqat brauzerda qolgan (eski versiya) ro'yxat avval serverga yoziladi — keyin kod.
    syncAccount()
      .catch(() => undefined)
      .finally(() => void fetchCode());
  }, [fetchCode]);

  const go = useCallback(async () => {
    if (leaving.current) return;
    leaving.current = true;
    let target = plainTarget(oldPath);
    if (signedIn) {
      const current = code.current && Date.now() - code.current.at < CODE_MAX_AGE_MS ? code.current : await fetchCode();
      if (current) target = transferTarget(current.value, oldPath);
    }
    window.location.replace(target);
  }, [oldPath, signedIn, fetchCode]);

  useEffect(() => {
    if (seconds <= 0) {
      void go();
      return;
    }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds, go]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-amber-500/15 blur-[120px]"
      />
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <section
        aria-labelledby="moved-title"
        className="glass relative flex w-full max-w-lg flex-col items-center gap-6 rounded-3xl border-amber-400/25 px-6 py-10 text-center shadow-[0_0_80px_-30px_rgba(251,191,36,0.45)] sm:px-10"
        data-testid="moved"
      >
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-background">
            <GaugeIcon className="size-5" strokeWidth={2.4} />
          </span>
          <span className="font-display text-sm font-bold tracking-[0.2em] text-foreground uppercase">PravaIshonch</span>
        </div>

        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.25em] text-amber-300 uppercase">{t.moved.eyebrow}</p>
          <h1 id="moved-title" className="mt-3 font-display text-2xl leading-snug font-extrabold text-foreground sm:text-3xl">
            {t.moved.titlePre}{" "}
            <span className="block break-words bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
              {DISPLAY_DOMAIN}
            </span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">{t.moved.body}</p>
        </div>

        {signedIn && (
          <p className="flex items-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/5 px-4 py-2.5 text-sm font-medium text-amber-100">
            <ShieldCheckIcon className="size-4 shrink-0 text-amber-300" aria-hidden="true" />
            {t.moved.signedIn}
          </p>
        )}

        <button
          type="button"
          onClick={() => void go()}
          className={buttonClasses({
            size: "lg",
            className:
              "w-full border-0 bg-gradient-to-r from-amber-300 to-amber-500 text-background hover:from-amber-200 hover:to-amber-400 sm:w-auto",
          })}
          data-testid="moved-go"
        >
          {t.moved.button}
          <ArrowRightIcon className="size-4" />
        </button>

        <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground tabular-nums" aria-live="polite" data-testid="moved-countdown">
          <CheckCircle2Icon className="size-3.5 text-amber-300" aria-hidden="true" />
          {t.moved.countdown(Math.max(0, seconds))}
        </p>
      </section>
    </main>
  );
}
