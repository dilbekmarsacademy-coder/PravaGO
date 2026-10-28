"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CameraIcon, CheckIcon, CropIcon, EraserIcon, ImageIcon, RotateCcwIcon, ScissorsIcon, Trash2Icon, UploadIcon, Undo2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { adminAssetUrl } from "@/lib/admin/api";
import { acceptImage, startJob, uploadImage, validateFile, waitForJob, type ImageJob, type NormRect } from "@/lib/admin/images";
import { resolveAssetUrl } from "@/lib/api/test";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Spinner } from "@/components/admin/ui";
import type { QuestionImage } from "@/components/admin/question/draft";

type Stage = "idle" | "uploading" | "processing" | "review" | "manual";
type Tool = "erase" | "crop";

const JOB_LABEL: Record<ImageJob["type"], string> = {
  auto: "Avtomatik tozalanmoqda (AI aniqlash → inpainting → chetlarni kesish)…",
  manual: "Qo'lda tahrir qo'llanmoqda…",
  original: "Asl rasm WebP formatiga o'tkazilmoqda…",
  "remove-bg": "Fon kesilmoqda (bir necha soniya)…",
};

interface ImageFieldProps {
  image: QuestionImage | null;
  /** Tasdiqlangan rasm (yoki `null` — olib tashlandi). */
  onChange: (image: QuestionImage | null, previewUrl?: string) => void;
}

/** Rasm: yuklash / drag-and-drop / kamera → avtomatik tozalash → "Oldin / Keyin" → tasdiqlash. */
export default function ImageField({ image, onChange }: ImageFieldProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [originalId, setOriginalId] = useState<string | null>(null);
  const [job, setJob] = useState<ImageJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tool, setTool] = useState<Tool>("erase");
  const [erase, setErase] = useState<NormRect[]>([]);
  const [crop, setCrop] = useState<NormRect | null>(null);
  const [trim, setTrim] = useState(true);
  const [draft, setDraft] = useState<NormRect | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const drawStart = useRef<{ x: number; y: number } | null>(null);

  async function run(input: string, type: ImageJob["type"], params: Parameters<typeof startJob>[2] = {}) {
    setStage("processing");
    setError(null);
    try {
      const started = await startJob(input, type, params);
      setJob(started);
      const done = await waitForJob(started.id, setJob);
      if (done.status === "failed") throw new Error(done.error ?? "Ishlov berilmadi");
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
      setStage(originalId ? "review" : "idle");
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const problem = validateFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStage("uploading");
    try {
      const { asset, job: first } = await uploadImage(file);
      setOriginalId(asset.id);
      setJob(first);
      setStage("processing");
      const done = await waitForJob(first.id, setJob);
      if (done.status === "failed") throw new Error(done.error ?? "Ishlov berilmadi");
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklanmadi");
      setStage("idle");
    }
  }

  async function accept() {
    if (!job?.outputAssetId) return;
    try {
      const accepted = await acceptImage(job.outputAssetId);
      onChange({ url: accepted.url, width: accepted.width, height: accepted.height, assetId: accepted.assetId }, adminAssetUrl(accepted.assetId));
      setStage("idle");
      setJob(null);
      setOriginalId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tasdiqlanmadi");
    }
  }

  // Qo'lda hudud chizish (rasmga nisbatan 0..1).
  function point(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)) };
  }
  function onDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawStart.current = point(e);
    setDraft({ ...drawStart.current, w: 0, h: 0 });
  }
  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drawStart.current) return;
    const p = point(e);
    const s = drawStart.current;
    setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  }
  function onUp() {
    if (draft && draft.w > 0.01 && draft.h > 0.01) {
      if (tool === "erase") setErase((list) => [...list, draft]);
      else setCrop(draft);
    }
    drawStart.current = null;
    setDraft(null);
  }

  const busy = stage === "uploading" || stage === "processing";
  const steps = job?.result?.steps ?? [];

  if (stage === "idle") {
    return (
      <div className="flex flex-col gap-3">
        {image && (
          <div className="flex flex-wrap items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveAssetUrl(image.url) ?? image.url} alt="Joriy rasm" className="max-h-48 rounded-xl border border-border object-contain" />
            <Button size="sm" variant="danger" onClick={() => onChange(null)}>
              <Trash2Icon className="size-4" /> Rasmni o&apos;chirish
            </Button>
          </div>
        )}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragging ? "border-brand bg-brand/5" : "border-border-strong",
          )}
        >
          <ImageIcon className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Rasmni shu yerga tashlang yoki tanlang (JPEG, PNG, WebP, HEIC — 10 MB gacha)</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              <UploadIcon className="size-4" /> {image ? "Almashtirish" : "Rasm tanlash"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => cameraRef.current?.click()}>
              <CameraIcon className="size-4" /> Telefondan suratga olish
            </Button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="image-input" onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  const before = originalId ? adminAssetUrl(originalId) : null;
  const after = job?.outputAssetId && stage !== "processing" ? adminAssetUrl(job.outputAssetId) : null;

  return (
    <div className="flex flex-col gap-3" data-testid="image-review">
      {busy && (
        <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
          <Spinner className="size-4" /> {stage === "uploading" ? "Yuklanmoqda…" : job ? JOB_LABEL[job.type] : "Ishlov berilmoqda…"}
        </div>
      )}
      {stage === "manual" && before ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={tool === "erase" ? "primary" : "secondary"} onClick={() => setTool("erase")}>
              <EraserIcon className="size-4" /> O&apos;chiriladigan hudud
            </Button>
            <Button size="sm" variant={tool === "crop" ? "primary" : "secondary"} onClick={() => setTool("crop")}>
              <CropIcon className="size-4" /> Qirqish
            </Button>
            <label className="inline-flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={trim} onChange={(e) => setTrim(e.target.checked)} className="accent-[var(--brand)]" /> chetlarni avtomatik kesish
            </label>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setErase([]);
                setCrop(null);
              }}
            >
              <Undo2Icon className="size-4" /> Tozalash
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Asl rasm ustida sichqoncha yoki barmoq bilan to&apos;rtburchak chizing.</p>
          <div className="relative inline-block max-w-full touch-none self-start select-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={before} alt="Asl rasm" className="pointer-events-none max-h-[60vh] max-w-full rounded-xl" draggable={false} />
            {erase.map((r, i) => (
              <Box key={i} r={r} className="border-danger bg-danger/25" />
            ))}
            {crop && <Box r={crop} className="border-brand bg-brand/10" />}
            {draft && <Box r={draft} className={tool === "erase" ? "border-danger bg-danger/20" : "border-brand bg-brand/10"} />}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => run(originalId!, "manual", { erase, crop: crop ?? undefined, trim })} disabled={!erase.length && !crop && !trim}>
              Qo&apos;llash
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setStage("review")}>
              Bekor qilish
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <figure className="flex flex-col gap-1.5">
              <figcaption className="font-mono text-[0.68rem] font-bold tracking-wide text-muted-foreground uppercase">Oldin</figcaption>
              {before && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={before} alt="Oldin" className="max-h-72 w-full rounded-xl border border-border bg-white object-contain" />
                </div>
              )}
            </figure>
            <figure className="flex flex-col gap-1.5">
              <figcaption className="font-mono text-[0.68rem] font-bold tracking-wide text-muted-foreground uppercase">Keyin</figcaption>
              {after ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={after} alt="Keyin" className="max-h-72 w-full rounded-xl border border-success/40 bg-white object-contain" data-testid="image-after" />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">{busy && <Spinner />}</div>
              )}
            </figure>
          </div>
          {stage === "review" && (
            <>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {job?.result?.aiConfigured === false && <Badge tone="muted">AI aniqlash: sozlanmagan</Badge>}
                {steps.map((s) => (
                  <span key={s} className="rounded-full bg-foreground/5 px-2 py-0.5">
                    {s}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={accept} disabled={!job?.outputAssetId} data-testid="image-accept">
                  <CheckIcon className="size-4" /> Qabul qilish
                </Button>
                <Button size="sm" variant="secondary" onClick={() => run(originalId!, "auto")}>
                  <RotateCcwIcon className="size-4" /> Qayta urinish
                </Button>
                <Button size="sm" variant="secondary" onClick={() => run(originalId!, "original")}>
                  <ImageIcon className="size-4" /> Asl rasmni ishlatish
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setErase(job?.result?.detections ?? []);
                    setCrop(null);
                    setStage("manual");
                  }}
                >
                  <EraserIcon className="size-4" /> Qo&apos;lda crop / o&apos;chirish
                </Button>
                <Button size="sm" variant="secondary" onClick={() => job?.outputAssetId && run(job.outputAssetId, "remove-bg")}>
                  <ScissorsIcon className="size-4" /> Fonni kesish
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setStage("idle");
                    setJob(null);
                    setOriginalId(null);
                  }}
                >
                  Bekor qilish
                </Button>
              </div>
            </>
          )}
        </>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function Box({ r, className }: { r: NormRect; className: string }) {
  return (
    <span
      className={cn("pointer-events-none absolute rounded-sm border-2", className)}
      style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
    />
  );
}
