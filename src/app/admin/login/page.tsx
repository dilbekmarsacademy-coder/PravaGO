"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { GaugeIcon, LockKeyholeIcon } from "lucide-react";
import { adminFetch, AdminApiError } from "@/lib/admin/api";
import { Button } from "@/components/shared/Button";
import { Field, Spinner, TextInput } from "@/components/admin/ui";

function LoginForm() {
  const params = useSearchParams();
  const [accessCode, setAccessCode] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminFetch("auth/login", { json: { accessCode: accessCode.trim(), login: login.trim(), password } });
      const next = params.get("next");
      // Faqat ichki /admin manzillariga qaytaramiz (open redirect bo'lmasligi uchun).
      window.location.href = next && next.startsWith("/admin/") && !next.startsWith("//") ? next : "/admin/dashboard";
    } catch (err) {
      setPassword("");
      setError(err instanceof AdminApiError ? err.message : "Server bilan aloqa yo'q");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass flex w-full max-w-sm flex-col gap-4 rounded-2xl p-6 sm:p-7" noValidate>
      <div className="mb-2 flex items-center gap-2.5">
        <span className="glow-orange flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 text-background">
          <GaugeIcon className="size-5" strokeWidth={2.4} />
        </span>
        <div>
          <p className="font-display text-sm font-bold tracking-wide uppercase">PravaTayyor</p>
          <p className="text-xs text-muted-foreground">Boshqaruv paneli</p>
        </div>
      </div>
      <Field label="Maxsus kod">
        <TextInput value={accessCode} onChange={(e) => setAccessCode(e.target.value)} autoComplete="off" required className="font-mono" name="accessCode" />
      </Field>
      <Field label="Login">
        <TextInput value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" required name="login" />
      </Field>
      <Field label="Parol">
        <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required name="password" />
      </Field>
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={busy || !accessCode || !login || !password} className="mt-1">
        {busy ? <Spinner className="text-brand-foreground" /> : <LockKeyholeIcon className="size-4" />}
        Kirish
      </Button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Suspense fallback={<Spinner />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
