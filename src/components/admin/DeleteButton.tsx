"use client";

// O'chirish tugmasi — ikki bosqichli tasdiq (brauzer confirm() oynasisiz),
// so'rov paytida bloklanadi, xato bo'lsa toast ko'rsatadi.

import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";

export default function DeleteButton({
  onDelete,
  label = "O'chirish",
  confirmLabel = "Ha, o'chirish",
  iconOnly = false,
  testId,
}: {
  onDelete: () => Promise<void>;
  label?: string;
  confirmLabel?: string;
  /** Ro'yxat qatorlarida — faqat ikonka. */
  iconOnly?: boolean;
  testId?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await onDelete();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "O'chirib bo'lmadi", tone: "danger" });
      setBusy(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Button size="sm" variant="danger" onClick={run} disabled={busy} data-testid={testId && `${testId}-confirm`}>
          <Trash2Icon className="size-4" /> {busy ? "O'chirilmoqda…" : confirmLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
          Bekor
        </Button>
      </span>
    );
  }
  return iconOnly ? (
    <Button size="icon-sm" variant="ghost" className="hover:text-danger" onClick={() => setConfirming(true)} aria-label={label} title={label} data-testid={testId}>
      <Trash2Icon className="size-4" />
    </Button>
  ) : (
    <Button size="sm" variant="danger" onClick={() => setConfirming(true)} data-testid={testId}>
      <Trash2Icon className="size-4" /> {label}
    </Button>
  );
}
