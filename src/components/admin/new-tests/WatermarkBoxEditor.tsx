"use client";

// Watermark joyini qo'lda belgilash: asl rasm ustida sichqoncha/barmoq bilan to'rtburchak chiziladi
// (0..1 koordinatalar) → backend shu joylarni qayta tozalaydi. Yoki AI'ga qayta aniqlatish.

import { useRef, useState, type PointerEvent } from "react";
import { SparklesIcon, Trash2Icon, XIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { imageUrl, type ImageBox } from "@/lib/admin/ai-import";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { Spinner } from "@/components/admin/ui";

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export default function WatermarkBoxEditor({ imageId, initial, onClose, onDone }: { imageId: string; initial: ImageBox[]; onClose: () => void; onDone: () => void }) {
  const [boxes, setBoxes] = useState<ImageBox[]>(() => initial.map(({ x, y, w, h }) => ({ x, y, w, h })));
  const [draft, setDraft] = useState<ImageBox | null>(null);
  const [busy, setBusy] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const area = useRef<HTMLDivElement>(null);

  function point(e: PointerEvent) {
    const r = area.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  }

  function onDown(e: PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = point(e);
    setDraft({ ...start.current, w: 0, h: 0 });
  }

  function onMove(e: PointerEvent) {
    if (!start.current) return;
    const p = point(e);
    const s = start.current;
    setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  }

  function onUp() {
    if (draft && draft.w > 0.01 && draft.h > 0.01 && boxes.length < 10) setBoxes((b) => [...b, draft]);
    start.current = null;
    setDraft(null);
  }

  async function submit(manual: boolean) {
    setBusy(true);
    try {
      await adminFetch(`ai-imports/images/${imageId}/reclean`, { json: manual ? { boxes } : {} });
      showToast({ message: "Rasm qayta tozalandi", tone: "success" });
      onDone();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Watermark joyini belgilash">
      <div className="max-h-full w-full max-w-4xl overflow-auto rounded-2xl border border-border bg-popover p-5 shadow-card">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="flex-1 font-bold">Watermark joyini belgilang</h3>
          <Button size="icon-sm" variant="ghost" aria-label="Yopish" onClick={onClose}>
            <XIcon className="size-4" />
          </Button>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">Rasm ustida logotip yoki yozuv atrofida to&apos;rtburchak chizing (bir nechta bo&apos;lishi mumkin). Faqat belgilangan joylar tozalanadi.</p>
        <div ref={area} className="relative mx-auto w-fit touch-none select-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-testid="ai-box-area">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl(imageId, "original")} alt="" draggable={false} className="block max-h-[60vh] max-w-full" />
          {[...boxes, ...(draft ? [draft] : [])].map((b, i) => (
            <div key={i} className="pointer-events-none absolute border-2 border-danger bg-danger/20" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }} />
          ))}
        </div>
        {boxes.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2 text-xs">
            {boxes.map((b, i) => (
              <li key={i} className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2.5 py-1">
                {i + 1}: {Math.round(b.x * 100)}%, {Math.round(b.y * 100)}% — {Math.round(b.w * 100)}×{Math.round(b.h * 100)}%
                <button type="button" aria-label="O'chirish" className="text-muted-foreground hover:text-danger" onClick={() => setBoxes(boxes.filter((_, k) => k !== i))}>
                  <Trash2Icon className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => submit(false)}>
            <SparklesIcon className="size-4" /> AI qayta aniqlasin
          </Button>
          <Button
            size="sm"
            disabled={busy || !boxes.length}
            onClick={() => submit(true)}
            data-testid="ai-box-submit"
          >
            {busy && <Spinner className="size-4" />} Belgilangan joylarni tozalash
          </Button>
        </div>
      </div>
    </div>
  );
}
