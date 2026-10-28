"use client";

import { useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import type { AdminPayment } from "@/lib/admin/types";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { TextInput } from "@/components/admin/ui";

type Action = "confirm" | "cancel";

/** Tasdiqlash / bekor qilish — ikki bosqichli (izoh bilan), tasodifiy bosilishdan himoya. */
export default function PaymentActions({ payment, onDone }: { payment: AdminPayment; onDone: () => void }) {
  const [pending, setPending] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!pending) return;
    setBusy(true);
    try {
      await adminFetch(`payments/${payment.id}/${pending}`, { json: note.trim() ? { note: note.trim() } : {} });
      showToast({ message: pending === "confirm" ? "To'lov tasdiqlandi — kurs ochildi" : "To'lov bekor qilindi", tone: "success" });
      setPending(null);
      setNote("");
      onDone();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="flex min-w-56 flex-col gap-2">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Izoh (ixtiyoriy)" maxLength={500} className="h-9" autoFocus />
        <div className="flex gap-2">
          <Button size="sm" variant={pending === "confirm" ? "primary" : "danger"} disabled={busy} onClick={submit}>
            {pending === "confirm" ? "Ha, tasdiqlash" : "Ha, bekor qilish"}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPending(null)}>
            Ortga
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {payment.status !== "CONFIRMED" && (
        <Button size="sm" onClick={() => setPending("confirm")}>
          <CheckIcon className="size-4" /> Tasdiqlash
        </Button>
      )}
      {payment.status !== "CANCELLED" && (
        <Button size="sm" variant="danger" onClick={() => setPending("cancel")}>
          <XIcon className="size-4" /> Bekor qilish
        </Button>
      )}
    </div>
  );
}
