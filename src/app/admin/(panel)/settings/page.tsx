"use client";

import { useState, type FormEvent } from "react";
import { adminFetch, AdminApiError } from "@/lib/admin/api";
import { formatDateTime } from "@/lib/admin/format";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { useAdmin } from "@/components/admin/AdminShell";
import { Field, PageHeader, Panel, TextInput } from "@/components/admin/ui";

const MIN_LENGTH = 12;

export default function AdminSettingsPage() {
  const admin = useAdmin();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < MIN_LENGTH) return setError(`Yangi parol kamida ${MIN_LENGTH} belgi bo'lishi kerak`);
    if (next !== repeat) return setError("Yangi parollar mos emas");
    setBusy(true);
    try {
      await adminFetch("auth/change-password", { json: { currentPassword: current, newPassword: next } });
      setCurrent("");
      setNext("");
      setRepeat("");
      showToast({ message: "Parol o'zgartirildi. Boshqa qurilmalardagi sessiyalar yopildi.", tone: "success" });
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Sozlamalar" subtitle="Profil va xavfsizlik" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Profil">
          {admin ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Ism</dt>
              <dd>{admin.name}</dd>
              <dt className="text-muted-foreground">Login</dt>
              <dd className="font-mono">{admin.login}</dd>
              <dt className="text-muted-foreground">Rol</dt>
              <dd>{admin.role === "OWNER" ? "Sayt egasi (OWNER)" : "Dasturchi (DEVELOPER)"}</dd>
              <dt className="text-muted-foreground">Oxirgi kirish</dt>
              <dd>{formatDateTime(admin.lastLoginAt)}</dd>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
          )}
        </Panel>
        <Panel title="Parolni o'zgartirish">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Joriy parol">
              <TextInput type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
            </Field>
            <Field label="Yangi parol" hint={`Kamida ${MIN_LENGTH} belgi`}>
              <TextInput type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Yangi parol (takror)">
              <TextInput type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={busy || !current || !next} className="self-start">
              Saqlash
            </Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
