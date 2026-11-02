"use client";

// Sozlama: ma'lum watermark namunasi (logotip). Bo'lsa — avval shablon bo'yicha qidiriladi,
// keyin AI tekshiradi. Namuna faqat admin storage'ida saqlanadi.

import { useEffect, useRef, useState } from "react";
import { ImageUpIcon, Trash2Icon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { Field, Panel, Select, Spinner } from "@/components/admin/ui";

interface Sample {
  storageKey: string;
  position: string | null;
  updatedAt: string;
}

const POSITIONS = [
  { value: "", label: "Har qayerda" },
  { value: "bottom-right", label: "Pastki o'ng burchak" },
  { value: "bottom-left", label: "Pastki chap burchak" },
  { value: "top-right", label: "Yuqori o'ng burchak" },
  { value: "top-left", label: "Yuqori chap burchak" },
  { value: "center", label: "O'rtada" },
];

export default function WatermarkSampleSetting() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sample, setSample] = useState<Sample | null | undefined>(undefined);
  const [position, setPosition] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminFetch<Sample | null | "">("ai-imports/settings/watermark")
      .then((s) => {
        setSample(s || null);
        if (s) setPosition(s.position ?? "");
      })
      .catch(() => setSample(null));
  }, []);

  async function save(file: File | null) {
    setBusy(true);
    try {
      const form = new FormData();
      if (file) form.append("file", file, file.name);
      if (position) form.append("position", position);
      const s = await adminFetch<Sample | null | "">("ai-imports/settings/watermark", { method: "POST", body: form });
      setSample(s || null);
      showToast({ message: file ? "Namuna saqlandi" : "Namuna o'chirildi", tone: "success" });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Watermark namunasi (ixtiyoriy)">
      <p className="mb-4 text-sm text-muted-foreground">
        Rasmlarda doim bir xil logotip yoki yozuv uchrasa, uning kesib olingan rasmini yuklang (PNG/JPG, 4 MB gacha). Shunda u avval shu namuna bo&apos;yicha qidiriladi, keyin AI tekshiradi.
      </p>
      {sample === undefined ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {sample && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/admin/api/ai-imports/settings/watermark/file?v=${encodeURIComponent(sample.updatedAt)}`} alt="Watermark namunasi" className="h-16 max-w-48 rounded-lg border border-border bg-[repeating-conic-gradient(#8882_0_25%,transparent_0_50%)] bg-[length:12px_12px] object-contain p-1" />
          )}
          <Field label="Odatda qayerda turadi" className="sm:w-64">
            <Select value={position} onChange={(e) => setPosition(e.target.value)}>
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2 sm:mb-5">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              <ImageUpIcon className="size-4" /> {sample ? "Almashtirish" : "Namuna yuklash"}
            </Button>
            {sample && (
              <Button variant="danger" size="sm" disabled={busy} onClick={() => save(null)}>
                <Trash2Icon className="size-4" /> O&apos;chirish
              </Button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) save(f);
            }}
          />
        </div>
      )}
    </Panel>
  );
}
