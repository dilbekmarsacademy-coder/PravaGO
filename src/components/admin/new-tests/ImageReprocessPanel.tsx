"use client";

// Saytdagi (allaqachon tasdiqlangan) AI import rasmlarini yangi usul bilan qayta ishlash:
// aniq niqob + patch-inpainting va asl o'lchamdagi lossless WebP. Avval "Tekshirish" (dryRun —
// hech narsa yozilmaydi), keyin tasdiqlab ishga tushiriladi (5 tadan bo'laklab). Originali yo'q
// rasmlar o'zgartirilmaydi — ro'yxati ko'rsatiladi.

import { useState } from "react";
import { RefreshCwIcon, SearchCheckIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { Panel, Spinner } from "@/components/admin/ui";

interface PlanItem {
  questionId: string;
  topicTitle: string;
  order: number;
  action: "reclean" | "lossless";
}
interface DryRun {
  willChange: number;
  reclean: number;
  losslessOnly: number;
  alreadyDone: number;
  pending: PlanItem[];
  withoutOriginal: { questionId: string; topicTitle: string; order: number; reason: string }[];
}
interface RunResult {
  processed: { questionId: string }[];
  failed: { questionId: string; error: string }[];
  remaining: number;
}

export default function ImageReprocessPanel() {
  const [plan, setPlan] = useState<DryRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState<{ done: number; failed: number } | null>(null);

  async function check() {
    setBusy(true);
    setConfirm(false);
    try {
      setPlan(await adminFetch<DryRun>("ai-imports/images/reprocess", { method: "POST", json: { dryRun: true } }));
    } catch (err) {
      showToast({ tone: "danger", message: err instanceof Error ? err.message : "Xatolik" });
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    setBusy(true);
    setConfirm(false);
    let done = 0;
    let failed = 0;
    setProgress({ done, failed });
    try {
      // Bo'laklab: har so'rov ≤ 5 rasm (server vaqt chegarasi). Xato bo'lganlar qayta urinilmaydi.
      for (let guard = 0; guard < 200; guard++) {
        const r = await adminFetch<RunResult>("ai-imports/images/reprocess", { method: "POST", json: { dryRun: false, limit: 5 } });
        done += r.processed.length;
        failed += r.failed.length;
        setProgress({ done, failed });
        if (r.remaining <= r.failed.length || r.processed.length === 0) break;
      }
      showToast({ tone: failed ? "danger" : "success", message: `${done} ta rasm qayta ishlandi${failed ? `, ${failed} ta xato` : ""}` });
    } catch (err) {
      showToast({ tone: "danger", message: err instanceof Error ? err.message : "Xatolik" });
    } finally {
      setBusy(false);
      await check();
    }
  }

  return (
    <Panel title="Saytdagi rasmlarni yangi usul bilan qayta ishlash">
      <p className="mb-3 text-sm text-muted-foreground">
        Avval tasdiqlangan biletlardagi rasmlar watermark joyida xira dog&apos; bilan va qayta siqilgan holda saqlangan bo&apos;lishi mumkin. Bu yerda ular asl nusxadan qayta ishlanadi: watermark faqat aniq niqob ichida tozalanadi, rasm o&apos;lchami va sifati o&apos;zgarmaydi. Eski rasmlar o&apos;chirilmaydi (audit jurnalida eski manzil saqlanadi).
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={check} data-testid="reprocess-dry-run">
          <SearchCheckIcon className="size-4" /> Tekshirish (hech narsa o&apos;zgarmaydi)
        </Button>
        {plan && plan.willChange > 0 && !confirm && (
          <Button size="sm" disabled={busy} onClick={() => setConfirm(true)}>
            <RefreshCwIcon className="size-4" /> {plan.willChange} ta rasmni qayta ishlash
          </Button>
        )}
        {confirm && (
          <>
            <Button size="sm" variant="danger" disabled={busy} onClick={run} data-testid="reprocess-confirm">
              Ha, {plan?.willChange} ta rasmni almashtirish
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>
              Yo&apos;q
            </Button>
          </>
        )}
        {busy && <Spinner />}
      </div>
      {progress && busy && <p className="mt-2 text-sm">Qayta ishlandi: {progress.done}{progress.failed ? `, xato: ${progress.failed}` : ""}</p>}
      {plan && (
        <div className="mt-3 space-y-2 text-sm" data-testid="reprocess-plan">
          <p>
            O&apos;zgaradi: <b>{plan.willChange}</b> ta (watermark qayta tozalanadi: {plan.reclean}, faqat sifatli qayta chiqarish: {plan.losslessOnly}); allaqachon yangi usulda: {plan.alreadyDone}.
          </p>
          {plan.pending.length > 0 && (
            <details>
              <summary className="cursor-pointer">O&apos;zgaradigan savollar</summary>
              <ul className="mt-1 max-h-48 list-disc overflow-y-auto pl-5 text-xs">
                {plan.pending.map((p) => (
                  <li key={p.questionId}>
                    {p.topicTitle} — #{p.order} ({p.action === "reclean" ? "qayta tozalash" : "lossless"})
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p>
            Originali yo&apos;q (o&apos;zgartirilmaydi): <b>{plan.withoutOriginal.length}</b> ta
          </p>
          {plan.withoutOriginal.length > 0 && (
            <ul className="max-h-48 list-disc overflow-y-auto pl-5 text-xs text-muted-foreground">
              {plan.withoutOriginal.map((p) => (
                <li key={p.questionId}>
                  {p.topicTitle} — #{p.order}: {p.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}
