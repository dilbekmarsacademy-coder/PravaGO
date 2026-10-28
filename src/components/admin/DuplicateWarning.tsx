"use client";

import { useEffect, useState } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";

interface Similar {
  id: string;
  text: string;
  topicSlug: string;
  topicTitle: string;
  order: number;
  score: number;
}

/** Bazada o'xshash savol bo'lsa ogohlantiradi (saqlashga to'sqinlik qilmaydi). */
export default function DuplicateWarning({ text, excludeId }: { text: string; excludeId?: string }) {
  const [items, setItems] = useState<Similar[]>([]);

  useEffect(() => {
    const value = text.trim();
    const id = setTimeout(() => {
      if (value.length < 12) {
        setItems([]);
        return;
      }
      adminFetch<Similar[]>("questions/similar", { json: { text: value, ...(excludeId ? { excludeId } : {}) } })
        .then(setItems)
        .catch(() => setItems([]));
    }, 600);
    return () => clearTimeout(id);
  }, [text, excludeId]);

  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm" data-testid="duplicate-warning">
      <p className="mb-2 flex items-center gap-2 font-semibold text-warning">
        <TriangleAlertIcon className="size-4" /> Bazada o&apos;xshash savol bor
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((s) => (
          <li key={s.id} className="text-xs">
            <span className="font-mono text-muted-foreground">
              {s.score}% · {s.topicSlug} #{s.order}
            </span>{" "}
            — {s.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
