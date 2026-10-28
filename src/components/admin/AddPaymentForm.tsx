"use client";

import { useEffect, useState, type FormEvent } from "react";
import { adminFetch } from "@/lib/admin/api";
import { formatPhone } from "@/lib/admin/format";
import { fullName, type AdminUserRow, type Paged } from "@/lib/admin/types";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { Field, Select, TextInput } from "@/components/admin/ui";

/** Qo'lda to'lov qo'shish. `userId` berilsa — foydalanuvchi tanlash bosqichi yo'q. */
export default function AddPaymentForm({ userId, onDone }: { userId?: string; onDone: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AdminUserRow[]>([]);
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"CONFIRMED" | "PENDING">("CONFIRMED");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (userId || search.trim().length < 2) return;
    const id = setTimeout(() => {
      adminFetch<Paged<AdminUserRow>>(`users?q=${encodeURIComponent(search.trim())}&pageSize=8`)
        .then((r) => setResults(r.items))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(id);
  }, [search, userId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const target = userId ?? selected?.id;
    if (!target) return;
    setBusy(true);
    try {
      await adminFetch("payments", {
        json: { userId: target, status, ...(amount ? { amount: Number(amount) } : {}), ...(note ? { note } : {}) },
      });
      showToast({ message: "To'lov qo'shildi", tone: "success" });
      setSelected(null);
      setSearch("");
      setAmount("");
      setNote("");
      onDone();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      {!userId && (
        <div className="sm:col-span-2">
          {selected ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              <span>
                <b>{fullName(selected)}</b> <span className="font-mono text-xs text-muted-foreground">{formatPhone(selected.phone)}</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                O&apos;zgartirish
              </Button>
            </div>
          ) : (
            <Field label="Foydalanuvchi">
              <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ism yoki telefon bo'yicha qidiring" />
              {results.length > 0 && search.trim().length >= 2 && (
                <ul className="mt-1 overflow-hidden rounded-xl border border-border">
                  {results.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(u)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface"
                      >
                        <span>{fullName(u)}</span>
                        <span className="font-mono text-xs text-muted-foreground">{formatPhone(u.phone)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          )}
        </div>
      )}
      <Field label="Summa (so'm)" hint="Bo'sh qoldirilsa — toifa narxi">
        <TextInput inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="350000" />
      </Field>
      <Field label="Holat">
        <Select value={status} onChange={(e) => setStatus(e.target.value as "CONFIRMED" | "PENDING")}>
          <option value="CONFIRMED">Tasdiqlangan (kurs darhol ochiladi)</option>
          <option value="PENDING">Kutilmoqda</option>
        </Select>
      </Field>
      <Field label="Izoh" className="sm:col-span-2">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: naqd, Click o'tkazmasi" maxLength={500} />
      </Field>
      <Button type="submit" disabled={busy || (!userId && !selected)} className="self-start sm:col-span-2 sm:justify-self-start">
        To&apos;lov qo&apos;shish
      </Button>
    </form>
  );
}
