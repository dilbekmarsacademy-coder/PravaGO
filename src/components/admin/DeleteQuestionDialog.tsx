"use client";

// Kun mavzusi savolini o'chirish: savol ostidagi "Savolni o'chirish" tugmasi →
// tasdiqlash oynasi (savolning TO'LIQ matni, uzun bo'lsa oyna ichida
// aylantiriladi) → "Ha, o'chirish" / "Yo'q". So'rov ketayotganda ikkala tugma
// ham, oynani yopish ham bloklanadi — ikki marta bosish yoki parallel ikki so'rov
// bo'lmaydi (ref bilan qo'shimcha himoya). "Yo'q" yoki oynani yopish — hech
// narsa o'zgarmaydi. Backend: DELETE /admin/content/questions/:id (yumshoq o'chirish).

import { useRef, useState } from "react";
import { Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { showToast } from "@/components/shared/Toast";

export function DeleteQuestionButton({
  question,
  onDeleted,
}: {
  question: { id: string; order: number; text: string };
  onDeleted: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`content/questions/${question.id}`, { method: "DELETE" });
      setOpen(false);
      showToast({ tone: "success", message: `#${question.order}-savol o'chirildi` });
      onDeleted(question.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'chirib bo'lmadi");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="danger"
        className="min-h-10 sm:min-h-0"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        data-testid={`delete-question-${question.order}`}
      >
        <Trash2Icon className="size-4" /> Savolni o&apos;chirish
      </Button>
      <Modal
        open={open}
        // So'rov paytida yopilmaydi (natija noma'lum qolmasin).
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        icon={
          <span className="flex size-12 items-center justify-center rounded-full bg-danger/15 text-danger">
            <TriangleAlertIcon className="size-5" />
          </span>
        }
        title="Rostan ham shu savolni o'chirasizmi?"
        description={`#${question.order}-savol saytdan (test, kalit so'zlar, random test va yakuniy imtihon) olib tashlanadi. Eski natijalar va arxiv o'zgarmaydi.`}
      >
        <div
          className="max-h-[40vh] overflow-y-auto rounded-xl border border-border bg-background/60 p-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground"
          data-testid="delete-question-text"
          tabIndex={0}
          aria-label="Savol matni"
        >
          {question.text}
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" className="min-h-11 sm:min-h-0" onClick={() => setOpen(false)} disabled={busy} data-testid="delete-question-no">
            Yo&apos;q
          </Button>
          <Button
            variant="danger"
            className="min-h-11 bg-danger/10 font-bold sm:min-h-0"
            onClick={confirm}
            disabled={busy}
            aria-busy={busy}
            data-testid="delete-question-yes"
          >
            <Trash2Icon className="size-4" /> {busy ? "O'chirilmoqda…" : "Ha, o'chirish"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
