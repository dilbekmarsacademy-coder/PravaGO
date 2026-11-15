"use client";

// Oldin / Keyin: asl (watermarkli) va tozalangan rasm yonma-yon (telefonda — ustma-ust), ixtiyoriy
// niqob (o'zgargan joylar qizil) va har bir tozalangan hudud 300% kattalashtirilgan holda.
// Admin bilet saqlanishidan oldin har rasmni shu yerda tekshiradi; yoqmasa — "Original rasmni ishlat".

import { useState } from "react";
import { imageUrl, type ImageBox } from "@/lib/admin/ai-import";

const ZOOM = 3;
const PAD = 0.02;

function ZoomTile({ src, box, label, width, height }: { src: string; box: { x: number; y: number; w: number; h: number }; label: string; width: number; height: number }) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-0.5 text-[11px] text-muted-foreground">{label}</figcaption>
      <div className="overflow-x-auto rounded-lg border border-border">
        <div className="relative overflow-hidden" style={{ width: box.w * width * ZOOM, height: box.h * height * ZOOM, maxWidth: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute max-w-none select-none"
            style={{ width: width * ZOOM, height: height * ZOOM, left: -box.x * width * ZOOM, top: -box.y * height * ZOOM, imageRendering: "pixelated" }}
          />
        </div>
      </div>
    </figure>
  );
}

export default function ImageBeforeAfter({
  imageId,
  version,
  boxes,
  width,
  height,
}: {
  imageId: string;
  version: string | number;
  boxes: ImageBox[];
  width: number | null;
  height: number | null;
}) {
  const [showMask, setShowMask] = useState(false);
  const [maskMissing, setMaskMissing] = useState(false);
  const [zoom, setZoom] = useState(false);
  const before = imageUrl(imageId, "original", version);
  const after = imageUrl(imageId, "cleaned", version);
  const mask = imageUrl(imageId, "mask", version);
  const regions = boxes
    .filter((b) => b.w > 0 && b.h > 0)
    .map((b) => {
      const x = Math.max(0, b.x - PAD);
      const y = Math.max(0, b.y - PAD);
      return { x, y, w: Math.min(1 - x, b.w + PAD * 2), h: Math.min(1 - y, b.h + PAD * 2) };
    });

  return (
    <div className="mb-2 rounded-xl border border-border p-2" data-testid="image-before-after">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <figure>
          <figcaption className="mb-1 text-xs font-semibold text-muted-foreground">Oldin (asl)</figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt="Asl rasm" className="w-full rounded-lg border border-border object-contain" />
        </figure>
        <figure>
          <figcaption className="mb-1 text-xs font-semibold text-muted-foreground">Keyin (tozalangan)</figcaption>
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={after} alt="Tozalangan rasm" className="w-full rounded-lg border border-border object-contain" />
            {showMask && !maskMissing && (
              // Niqob: oq — o'zgargan piksellar; qizil rangda ko'rsatiladi (multiply emas, maska sifatida).
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-lg bg-red-500/70"
                style={{ maskImage: `url(${mask})`, WebkitMaskImage: `url(${mask})`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%", maskMode: "luminance" }}
              />
            )}
          </div>
        </figure>
      </div>
      {/* Niqob mavjudligini tekshirish (eski usulda tozalanganlarda yo'q). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mask} alt="" hidden onError={() => setMaskMissing(true)} />
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {!maskMissing && (
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showMask} onChange={(e) => setShowMask(e.target.checked)} /> Niqobni ko&apos;rsatish
          </label>
        )}
        {regions.length > 0 && width && height && (
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={zoom} onChange={(e) => setZoom(e.target.checked)} /> Tozalangan joylar 300%
          </label>
        )}
        {maskMissing && <span className="text-muted-foreground">Eski usulda tozalangan — &quot;Qayta tozalash&quot; bilan yangilang</span>}
      </div>
      {zoom && width && height && (
        <div className="mt-2 space-y-3">
          {regions.map((r, i) => (
            <div key={i} className="grid grid-cols-1 gap-2">
              <ZoomTile src={before} box={r} label={`${i + 1}-hudud — oldin`} width={width} height={height} />
              <ZoomTile src={after} box={r} label={`${i + 1}-hudud — keyin`} width={width} height={height} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
