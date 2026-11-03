"use client";

// Bitta AI import: fayllarni ochish → taxminiy narx → "Boshlash" → bosqichlar (har biri ≤ 40 s,
// sahifa navbatma-navbat chaqiradi; yangilansa ham davom etadi) → testlar ro'yxati va tekshiruv.

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangleIcon, PlayIcon, RefreshCwIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { FILE_KIND_LABEL, formatBytes, STAGE_LABEL, STATUS_LABEL, type ImportDetail, type StepResult } from "@/lib/admin/ai-import";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { ErrorBlock, LoadingBlock, PageHeader, Panel, Spinner, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { statusTone } from "./AiImportPanel";
import ImportTestReview from "./ImportTestReview";

const RUNNING = new Set(["uploading", "processing"]);
const STAGES = ["extract", "classify", "screens", "group", "match", "analyze", "images"];

function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {value} / {max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ImportBatchView({ batchId }: { batchId: string }) {
  const [detail, setDetail] = useState<ImportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);
  const [looping, setLooping] = useState(false);
  const running = useRef(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const d = await adminFetch<ImportDetail>(`ai-imports/${batchId}`);
      setDetail(d);
      setError(null);
      return d;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
      return null;
    }
  }, [batchId]);

  /** Qadamlarni ketma-ket chaqirish (bir vaqtda bitta). Xato bo'lsa — biroz kutib qayta. */
  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setLooping(true);
    let failures = 0;
    try {
      while (alive.current) {
        let res: StepResult;
        try {
          res = await adminFetch<StepResult>(`ai-imports/${batchId}/step`, { method: "POST" });
          failures = 0;
          setStepError(null);
        } catch (err) {
          failures++;
          setStepError(err instanceof Error ? err.message : "Xatolik");
          if (failures >= 5) break;
          await new Promise((r) => setTimeout(r, 2000 * failures));
          continue;
        }
        setDetail((d) => (d ? { ...d, status: res.status, stage: res.stage, stats: res.stats } : d));
        if (!res.continue) break;
        if (res.busy) await new Promise((r) => setTimeout(r, 1500));
      }
    } finally {
      running.current = false;
      if (alive.current) {
        setLooping(false);
        await load();
      }
    }
  }, [batchId, load]);

  useEffect(() => {
    alive.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().then((d) => {
      if (d && RUNNING.has(d.status)) run();
    });
    return () => {
      alive.current = false;
    };
  }, [load, run]);

  async function action(path: string, ok?: string) {
    setBusy(true);
    try {
      const d = await adminFetch<ImportDetail>(`ai-imports/${batchId}/${path}`, { method: "POST" });
      if (d && typeof d === "object") setDetail(d);
      if (ok) showToast({ message: ok, tone: "success" });
      run();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function removeFile(fileId: string) {
    try {
      await adminFetch(`ai-imports/${batchId}/files/${fileId}/delete`, { method: "POST" });
      await load();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    }
  }

  if (error && !detail) return <ErrorBlock message={error} onRetry={load} />;
  if (!detail) return <LoadingBlock />;

  const s = detail.stats;
  const isRunning = RUNNING.has(detail.status);
  const topFiles = detail.files.filter((f) => f.status !== "archive" || !f.parentId);
  const stageIndex = STAGES.indexOf(detail.stage);
  const selected = detail.tests.find((t) => t.id === testId) ?? null;

  return (
    <>
      <PageHeader
        title={`AI import — ${detail.group?.name ?? "to'plamsiz"}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(detail.status)}>{STATUS_LABEL[detail.status] ?? detail.status}</Badge>
            {isRunning && (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <Spinner className="size-3.5" /> {STAGE_LABEL[detail.stage] ?? detail.stage}
              </span>
            )}
          </span>
        }
      />

      {!detail.aiConfigured && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">AI kaliti sozlanmagan (ANTHROPIC_API_KEY) — faqat fayldagi ma&apos;lumotlar ishlatiladi, javobsiz savollarni o&apos;zingiz belgilaysiz.</div>
      )}
      {detail.budget.level !== "ok" && (
        <div className={`mb-4 rounded-xl border p-3 text-sm ${detail.budget.level === "blocked" ? "border-danger/40 bg-danger/10 text-danger" : "border-warning/40 bg-warning/10 text-warning"}`}>
          AI budjeti: ${detail.budget.spentUsd.toFixed(2)} / ${detail.budget.budgetUsd.toFixed(2)} (bu oy).{" "}
          {detail.budget.level === "blocked" ? "Limit tugadi — yangi AI so'rovlari to'xtatildi. Limitni AI_MONTHLY_BUDGET_USD bilan oshiring yoki keyingi oyni kuting." : "80% dan oshdi."}
        </div>
      )}
      {detail.status === "paused" && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" data-testid="ai-paused">
          <AlertTriangleIcon className="size-4" />
          <span className="flex-1">{detail.error ?? "Jarayon to'xtatildi"}</span>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => action("resume", "Davom ettirilmoqda")}>
            <PlayIcon className="size-4" /> Davom ettirish
          </Button>
        </div>
      )}
      {stepError && looping && <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">Qadam xatosi: {stepError}. Qayta urinilmoqda…</div>}
      {stepError && !looping && isRunning && (
        <Button size="sm" variant="secondary" className="mb-4" onClick={run}>
          <RefreshCwIcon className="size-4" /> Qayta urinish
        </Button>
      )}

      {(isRunning || detail.status === "paused") && (
        <Panel title="Jarayon" className="mb-6">
          <ol className="mb-5 flex flex-wrap gap-2 text-xs">
            {STAGES.map((st, i) => (
              <li key={st} className={`rounded-full px-3 py-1 ${i < stageIndex || detail.stage === "done" ? "bg-success/15 text-success" : i === stageIndex ? "bg-brand/15 font-semibold text-brand" : "bg-foreground/5 text-muted-foreground"}`}>
                {i + 1}. {STAGE_LABEL[st]}
              </li>
            ))}
          </ol>
          <div className="grid gap-4 md:grid-cols-3" data-testid="ai-progress">
            <Progress label="Fayllar ochildi" value={s.files?.extracted ?? 0} max={s.files?.total ?? 0} />
            <Progress label="Savollar tahlil qilindi" value={s.questions?.analyzed ?? 0} max={s.questions?.total ?? 0} />
            <Progress label="Rasmlar tozalandi" value={s.images?.done ?? 0} max={s.images?.total ?? 0} />
          </div>
        </Panel>
      )}

      {detail.status === "ready" && (
        <Panel title="Boshlashga tayyor" className="mb-6">
          <p className="mb-4 text-sm text-muted-foreground">Fayllar ochildi. Ortiqcha faylni olib tashlashingiz mumkin. &ldquo;Boshlash&rdquo;dan keyin AI tasniflaydi, testlarga ajratadi, javob va kalitlarni tekshiradi, rasmlarni tozalaydi.</p>
          <div className="mb-4 grid gap-3 sm:grid-cols-4" data-testid="ai-estimate">
            <StatCard label="Fayllar" value={s.estimate?.files ?? s.files?.total ?? 0} />
            <StatCard label="Savollar (taxminan)" value={s.estimate?.questions ?? 0} />
            <StatCard label="Rasmlar" value={s.estimate?.images ?? 0} />
            <StatCard label="Taxminiy narx" value={`≈ $${(s.estimate?.usd ?? 0).toFixed(2)}`} hint={`Bu oy: $${detail.budget.spentUsd.toFixed(2)} / $${detail.budget.budgetUsd.toFixed(2)}`} tone="brand" />
          </div>
          <Button onClick={() => action("start")} disabled={busy || detail.budget.level === "blocked"} data-testid="ai-start">
            {busy ? <Spinner className="size-4" /> : <PlayIcon className="size-4" />} Boshlash
          </Button>
        </Panel>
      )}

      {!isRunning && detail.status !== "ready" && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="ai-summary">
          <StatCard label="Testlar" value={detail.tests.length} />
          <StatCard label="Savollar" value={s.questions?.total ?? 0} hint={s.questions?.duplicates ? `${s.questions.duplicates} ta dublikat birlashtirildi` : undefined} />
          <StatCard label="Tekshirish kerak" value={s.questions?.reviewNeeded ?? 0} tone={s.questions?.reviewNeeded ? "warning" : "default"} />
          <StatCard label="Saytda bor (qo'shilmaydi)" value={s.questions?.existing ?? 0} />
          <StatCard label="Rasm muammosi" value={(s.images?.needsReview ?? 0) + (s.images?.error ?? 0)} tone={(s.images?.needsReview ?? 0) + (s.images?.error ?? 0) ? "warning" : "default"} />
        </div>
      )}
      {!isRunning && (s.images?.error ?? 0) > 0 && (
        <Button size="sm" variant="secondary" className="mb-4" disabled={busy} onClick={() => action("images/retry", "Rasmlar qayta ishlanmoqda")}>
          <RotateCcwIcon className="size-4" /> Xato rasmlarni qayta urinish ({s.images?.error})
        </Button>
      )}

      {detail.tests.length > 0 && !isRunning && (
        <Panel title="Testlar" className="mb-6">
          <Table>
            <thead>
              <tr>
                <Th>Test</Th>
                <Th>Kurs mavzusi</Th>
                <Th>Savollar</Th>
                <Th>Tasdiqlangan</Th>
                <Th>Tekshirish</Th>
                <Th>Holat</Th>
              </tr>
            </thead>
            <tbody>
              {detail.tests.map((t) => (
                <tr key={t.id} className={`cursor-pointer hover:bg-surface ${t.id === testId ? "bg-brand/5" : ""}`} onClick={() => setTestId(t.id)} data-testid="ai-test-row">
                  <Td>
                    <span className="font-semibold">{t.title}</span>
                  </Td>
                  <Td>{t.linkedTopicSlug ?? <span className="text-warning">bog&apos;lanmagan</span>}</Td>
                  <Td>{t.questionCount}</Td>
                  <Td>
                    {t.approvedCount} / {t.questionCount}
                  </Td>
                  <Td>{t.reviewCount ? <Badge tone="warning">{t.reviewCount}</Badge> : "—"}</Td>
                  <Td>{t.status === "approved" ? <Badge tone="success">Chiqarilgan</Badge> : <Badge tone="muted">Qoralama</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      {selected && <ImportTestReview key={selected.id} batchId={batchId} test={selected} tests={detail.tests} onChanged={load} />}

      <Panel title="Fayllar" className="mb-6">
        <Table>
          <thead>
            <tr>
              <Th>Fayl</Th>
              <Th>Hajm</Th>
              <Th>Turi</Th>
              <Th>Holat</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {topFiles.map((f) => (
              <tr key={f.id} data-testid="ai-file-row">
                <Td>
                  <span className={f.parentId ? "pl-4 text-muted-foreground" : ""}>{f.name}</span>
                  {(f.error || f.skipReason || f.classification?.reason) && <p className="mt-0.5 text-xs text-muted-foreground">{f.error ?? f.skipReason ?? f.classification?.reason}</p>}
                </Td>
                <Td>{formatBytes(f.size)}</Td>
                <Td>{f.classification ? FILE_KIND_LABEL[f.classification.kind] ?? f.classification.kind : "—"}</Td>
                <Td>
                  <Badge tone={f.status === "error" ? "danger" : f.status === "skipped" ? "warning" : f.status === "classified" || f.status === "extracted" ? "success" : "muted"}>{f.status}</Badge>
                </Td>
                <Td>
                  {f.status === "error" && (
                    <Button size="sm" variant="ghost" onClick={() => action(`files/${f.id}/retry`, "Qayta urinilmoqda")}>
                      <RotateCcwIcon className="size-4" /> Qayta
                    </Button>
                  )}
                  {(detail.status === "ready" || detail.status === "uploading") && !f.parentId && (
                    <Button size="icon-sm" variant="ghost" aria-label="Olib tashlash" onClick={() => removeFile(f.id)}>
                      <Trash2Icon className="size-4" />
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
