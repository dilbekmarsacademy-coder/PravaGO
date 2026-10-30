"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, InfoIcon, Loader2Icon, TriangleAlertIcon, XIcon } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/useLocale";
import { centerLogin } from "@/lib/api/center";
import { ApiError, clearSessionToken, type KickReason } from "@/lib/api/session";
import { clearRegistration, syncAccount } from "@/lib/registration-store";
import { resetSavedStore } from "@/lib/saved/store";

interface CenterLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Oldingi sessiya nega tugagani (boshqa qurilmadan kirilgan va h.k.). */
  notice?: KickReason | null;
}

function formatPhoneDigits(digits: string): string {
  const groups = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean);
  return groups.length ? `+998 ${groups.join(" ")}` : "+998";
}

function extractDigits(rawValue: string): string {
  let digits = rawValue.replace(/\D/g, "");
  if (digits.startsWith("998")) digits = digits.slice(3);
  return digits.slice(0, 9);
}

/** "Men shu yerda o'qiyman": telefon + login + parol → kunlar sahifasi. */
export default function CenterLoginModal({ open, onOpenChange, notice }: CenterLoginModalProps) {
  const router = useRouter();
  const { t } = useLocale();
  const labels = t.centerLogin;
  const [phoneDigits, setPhoneDigits] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChangeComplete(isOpen: boolean) {
    if (!isOpen) {
      setPassword("");
      setShowPassword(false);
      setError(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (phoneDigits.length !== 9) return setError(labels.errors.phoneIncomplete);
    if (!login.trim() || !password) return setError(labels.errors.required);

    setBusy(true);
    setError(null);
    try {
      // Oldingi (masalan anonim) sessiyaning ma'lumotlari yangi akkauntga aralashmasin.
      clearRegistration();
      clearSessionToken();
      resetSavedStore();
      await centerLogin({ phone: `+998${phoneDigits}`, login: login.trim(), password });
      await syncAccount();
      router.push("/kabinet");
    } catch (err) {
      setBusy(false);
      if (!(err instanceof ApiError)) return setError(labels.errors.network);
      if (err.status === 429) return setError(labels.errors.rateLimited);
      if (err.code === "ACCOUNT_INACTIVE") return setError(labels.errors.inactive);
      if (err.status === 401 || err.status === 400) return setError(labels.errors.invalid);
      setError(labels.errors.server);
    }
  }

  const noticeText = notice ? labels.kicked[notice === "SESSION_REPLACED" ? "replaced" : notice === "ACCOUNT_INACTIVE" ? "inactive" : "revoked"] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} onOpenChangeComplete={handleOpenChangeComplete}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92dvh] w-[calc(100%-2rem)] max-w-md gap-0 overflow-y-auto rounded-2xl border border-border bg-popover/90 p-0 text-card-foreground shadow-[0_25px_70px_-20px_rgba(0,0,0,0.75)] backdrop-blur-2xl sm:max-w-md"
        data-testid="center-login-modal"
      >
        <DialogClose
          render={
            <button
              type="button"
              className="absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-full border border-border bg-background/50 text-muted-foreground transition-colors hover:border-neon-orange/50 hover:text-neon-orange"
            />
          }
        >
          <XIcon className="size-4" />
          <span className="sr-only">{t.registerModal.yopish}</span>
        </DialogClose>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6 sm:p-8" noValidate>
          <div className="pr-10">
            <DialogTitle className="font-display text-xl font-bold text-foreground sm:text-2xl">{labels.title}</DialogTitle>
            <DialogDescription className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{labels.desc}</DialogDescription>
          </div>

          {noticeText && (
            <p role="status" data-testid="center-kicked" className="flex gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm leading-snug text-foreground">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
              {noticeText}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="center-phone" className="text-foreground/90">
              {labels.phone}
            </Label>
            <Input
              id="center-phone"
              name="phone"
              value={formatPhoneDigits(phoneDigits)}
              onChange={(e) => setPhoneDigits(extractDigits(e.target.value))}
              placeholder={labels.phonePlaceholder}
              inputMode="tel"
              autoComplete="tel"
              className="h-11 font-mono text-base"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="center-login" className="text-foreground/90">
              {labels.login}
            </Label>
            <Input
              id="center-login"
              name="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder={labels.loginPlaceholder}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="h-11 font-mono text-base"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="center-password" className="text-foreground/90">
              {labels.password}
            </Label>
            <div className="relative">
              <Input
                id="center-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="h-11 pr-12 font-mono text-base"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? labels.hidePassword : labels.showPassword}
                aria-pressed={showPassword}
                className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </button>
            </div>
          </div>

          <p className="flex gap-2 rounded-xl bg-foreground/[0.04] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
            {labels.oneDeviceNote}
          </p>

          {error && (
            <p role="alert" data-testid="center-login-error" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="glow-orange-hover h-auto w-full rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 py-3 text-base font-bold text-background sm:w-auto sm:self-start"
          >
            {busy && <Loader2Icon className="size-4 animate-spin" />}
            {busy ? labels.submitting : labels.submit}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
