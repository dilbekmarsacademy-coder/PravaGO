"use client";

// Markaz o'quvchilari uchun oynalar: qo'shish, ommaviy qo'shish, tahrirlash va
// bir martalik login/parol ko'rsatish (yopilgach parol qayta ko'rinmaydi).

import { useState, type FormEvent, type ReactNode } from "react";
import { CheckIcon, CopyIcon, DownloadIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { adminFetch, AdminApiError } from "@/lib/admin/api";
import { formatPhone } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/shared/Button";
import { Field, Spinner, TextArea, TextInput } from "@/components/admin/ui";

export interface StudentCredentials {
  id: string;
  name: string | null;
  phone: string;
  login: string;
  password: string;
}

export interface StudentRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  login: string | null;
  isActive: boolean;
  centerAccess: boolean;
  lastLoginAt: string | null;
  lastDevice: string | null;
  lastActiveAt: string | null;
  online: boolean;
  createdAt: string;
  progress: { percent: number; passedTopics: number; totalTopics: number; passedDays: number[] };
}

export function AdminDialog({
  open,
  onOpenChange,
  title,
  description,
  wide,
  children,
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  wide?: boolean;
  children: ReactNode;
  /** false — faqat ichidagi tugma bilan yopiladi (fon/Esc bilan tasodifan yopilmasin). */
  dismissible?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next || dismissible ? onOpenChange(next) : undefined)}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "max-h-[92dvh] w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-2xl border border-border bg-popover/95 p-5 text-card-foreground shadow-card backdrop-blur-2xl sm:p-6",
          wide ? "max-w-2xl sm:max-w-2xl" : "max-w-md sm:max-w-md",
        )}
      >
        {dismissible && (
          <DialogClose
            render={
              <button
                type="button"
                className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
              />
            }
          >
            <XIcon className="size-4" />
            <span className="sr-only">Yopish</span>
          </DialogClose>
        )}
        <DialogTitle className="pr-10 font-display text-lg font-bold text-foreground">{title}</DialogTitle>
        {description && <DialogDescription className="mt-1.5 text-sm text-muted-foreground">{description}</DialogDescription>}
        <div className="mt-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

function errorText(err: unknown): string {
  return err instanceof AdminApiError ? err.message : "Saqlab bo'lmadi";
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      title={label}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
    >
      {done ? <CheckIcon className="size-4 text-success" /> : <CopyIcon className="size-4" />}
    </Button>
  );
}

function credentialsText(list: StudentCredentials[]): string {
  return list.map((c) => [c.name, `Telefon: ${formatPhone(c.phone)}`, `Login: ${c.login}`, `Parol: ${c.password}`].filter(Boolean).join("\n")).join("\n\n");
}

function downloadCsv(list: StudentCredentials[]) {
  const cell = (v: string | null) => {
    const s = v ?? "";
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [["Ism", "Telefon", "Login", "Parol"].join(";"), ...list.map((c) => [c.name, c.phone, c.login, c.password].map(cell).join(";"))];
  const blob = new Blob([`﻿${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `markaz-oquvchilari-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Yaratilgan/yangilangan login va parollar — faqat shu oynada, bir marta. */
export function CredentialsDialog({
  list,
  errors,
  onClose,
  title = "Kirish ma'lumotlari",
}: {
  list: StudentCredentials[] | null;
  errors?: { line: number; value: string; message: string }[];
  onClose: () => void;
  title?: string;
}) {
  const open = list !== null;
  return (
    <AdminDialog open={open} onOpenChange={(next) => !next && onClose()} title={title} wide dismissible={false}>
      {list && (
        <div className="flex flex-col gap-4" data-testid="student-credentials">
          <p className="flex gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
            Parollar faqat hozir ko&apos;rinadi. Oyna yopilgach ularni qayta ko&apos;rib bo&apos;lmaydi — faqat yangilash mumkin. O&apos;quvchilarga hozir bering yoki nusxa oling.
          </p>
          {list.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="font-mono text-[0.68rem] tracking-wide text-muted-foreground uppercase">
                    <th className="px-3 py-2">Ism</th>
                    <th className="px-3 py-2">Telefon</th>
                    <th className="px-3 py-2">Login</th>
                    <th className="px-3 py-2">Parol</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id} className="border-t border-border/60">
                      <td className="px-3 py-1.5">{c.name ?? "—"}</td>
                      <td className="px-3 py-1.5 font-mono text-xs whitespace-nowrap">
                        {formatPhone(c.phone)} <CopyButton text={c.phone} label="Telefonni nusxalash" />
                      </td>
                      <td className="px-3 py-1.5 font-mono whitespace-nowrap" data-testid="credential-login">
                        {c.login} <CopyButton text={c.login} label="Loginni nusxalash" />
                      </td>
                      <td className="px-3 py-1.5 font-mono whitespace-nowrap" data-testid="credential-password">
                        {c.password} <CopyButton text={c.password} label="Parolni nusxalash" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {errors && errors.length > 0 && (
            <div className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              <p className="font-semibold">Qo&apos;shilmagan qatorlar ({errors.length}):</p>
              <ul className="mt-1 list-disc pl-5">
                {errors.map((e) => (
                  <li key={`${e.line}-${e.value}`}>
                    {e.line}-qator <span className="font-mono">{e.value}</span> — {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {list.length > 0 && (
              <>
                <Button variant="secondary" size="sm" onClick={() => copyText(credentialsText(list))}>
                  <CopyIcon className="size-4" /> Hammasini nusxalash
                </Button>
                <Button variant="secondary" size="sm" onClick={() => downloadCsv(list)}>
                  <DownloadIcon className="size-4" /> CSV yuklab olish
                </Button>
              </>
            )}
            <Button size="sm" className="ml-auto" onClick={onClose} data-testid="credentials-close">
              Yopish
            </Button>
          </div>
        </div>
      )}
    </AdminDialog>
  );
}

export function CreateStudentDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (c: StudentCredentials) => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await adminFetch<StudentCredentials>("students", {
        json: { phone: phone.trim(), ...(name.trim() ? { name: name.trim() } : {}), ...(login.trim() ? { login: login.trim() } : {}), ...(password ? { password } : {}) },
      });
      setPhone("");
      setName("");
      setLogin("");
      setPassword("");
      onCreated(created);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminDialog open={open} onOpenChange={onOpenChange} title="O'quvchi qo'shish" description="Login va parol bo'sh qoldirilsa, tizim o'zi yaratadi.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Telefon raqami">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" inputMode="tel" required name="phone" autoComplete="off" />
        </Field>
        <Field label="Ism familiya (ixtiyoriy)">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} name="name" autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Login (ixtiyoriy)" hint="Bo'sh — pt12345 ko'rinishida">
            <TextInput value={login} onChange={(e) => setLogin(e.target.value)} name="login" autoComplete="off" spellCheck={false} className="font-mono" />
          </Field>
          <Field label="Parol (ixtiyoriy)" hint="Bo'sh — 8 belgili oson parol">
            <TextInput value={password} onChange={(e) => setPassword(e.target.value)} name="new-password" autoComplete="off" spellCheck={false} className="font-mono" />
          </Field>
        </div>
        <FormError message={error} />
        <Button type="submit" disabled={busy || !phone.trim()} className="self-start" data-testid="student-create-submit">
          {busy && <Spinner className="size-4 text-brand-foreground" />} Qo&apos;shish
        </Button>
      </form>
    </AdminDialog>
  );
}

export function BulkStudentsDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: { created: StudentCredentials[]; errors: { line: number; value: string; message: string }[] }) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lines = text.split(/\r?\n/);
  const count = lines.filter((l) => l.trim()).length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || count === 0) return;
    if (lines.length > 200) return setError("Bir martada ko'pi bilan 200 qator");
    setBusy(true);
    setError(null);
    try {
      const result = await adminFetch<{ created: StudentCredentials[]; errors: { line: number; value: string; message: string }[] }>("students/bulk", { json: { phones: lines } });
      setText("");
      onCreated(result);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminDialog open={open} onOpenChange={onOpenChange} title="Ommaviy qo'shish" description="Har bir qatorga bitta telefon raqami. Login va parollar avtomatik yaratiladi.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Telefon raqamlari" hint={`${count} ta raqam`}>
          <TextArea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={"+998 90 123 45 67\n901234568\n998 93 111 22 33"} className="font-mono" name="phones" />
        </Field>
        <FormError message={error} />
        <Button type="submit" disabled={busy || count === 0} className="self-start">
          {busy && <Spinner className="size-4 text-brand-foreground" />} {count || ""} ta o&apos;quvchini qo&apos;shish
        </Button>
      </form>
    </AdminDialog>
  );
}

export function EditStudentDialog({ student, onClose, onSaved }: { student: StudentRow | null; onClose: () => void; onSaved: () => void }) {
  return (
    <AdminDialog open={student !== null} onOpenChange={(next) => !next && onClose()} title="O'quvchini tahrirlash">
      {student && <EditStudentForm key={student.id} student={student} onSaved={onSaved} />}
    </AdminDialog>
  );
}

function EditStudentForm({ student, onSaved }: { student: StudentRow; onSaved: () => void }) {
  const [name, setName] = useState([student.firstName, student.lastName].filter(Boolean).join(" "));
  const [phone, setPhone] = useState(student.phone ?? "");
  const [access, setAccess] = useState(student.centerAccess);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`students/${student.id}`, { method: "PATCH", json: { name: name.trim(), phone: phone.trim(), centerAccess: access } });
      onSaved();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Ism familiya">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} name="name" autoComplete="off" />
      </Field>
      <Field label="Telefon raqami">
        <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" name="phone" autoComplete="off" />
      </Field>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm">
        <input type="checkbox" checked={access} onChange={(e) => setAccess(e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand)]" />
        <span>
          <span className="font-semibold text-foreground">To&apos;liq kirish</span>
          <span className="block text-xs text-muted-foreground">Video darslar va testlar ochiq (to&apos;lov qilgan foydalanuvchi bilan teng). O&apos;chirilsa, o&apos;quvchi kira oladi, lekin kontent yopiq.</span>
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        Login: <span className="font-mono">{student.login}</span> — o&apos;zgarmaydi. Parolni ro&apos;yxatdagi &quot;Parolni yangilash&quot; tugmasi bilan almashtiring.
      </p>
      <FormError message={error} />
      <Button type="submit" disabled={busy} className="self-start">
        {busy && <Spinner className="size-4 text-brand-foreground" />} Saqlash
      </Button>
    </form>
  );
}
