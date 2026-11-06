"use client";

// Ogohlantirish: o'quvchiga ko'rinadigan savollarda kalit so'z yo'q yoki biror
// tilda (lotin, kirill, rus) to'liq emas. "AI bilan to'ldirish" — yetishmaganlari
// AI bilan qo'shiladi ("Tekshirilmagan" bo'lib qoladi). Hammasi to'liq bo'lsa — blok yo'q.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { KeyRoundIcon, SparklesIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { getAiConfigured } from "@/lib/admin/content";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { Spinner } from "@/components/admin/ui";

interface MissingItem {
  id: string;
  topicSlug: string;
  topicTitle: string;
  order: number;
  text: string;
  missing: string[];
}

const BATCH = 5;
const SHOWN = 30;

export default function MissingKeywordsBanner() {
  const [data, setData] = useState<{ total: number; items: MissingItem[] } | null>(null);
  const [ai, setAi] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    adminFetch<{ total: number; items: MissingItem[] }>("content/keywords/missing")
      .then(setData)
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    load();
    getAiConfigured().then(setAi);
  }, [load]);

  if (!data || data.total === 0) return null;

  async function fill() {
    if (!data) return;
    const ids = data.items.map((i) => i.id);
    const errors: Record<string, string> = {};
    let filled = 0;
    setProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        const res = await adminFetch<{ filled: number; failed: { id: string; reason: string }[] }>("content/keywords/fill", { json: { ids: ids.slice(i, i + BATCH) } });
        filled += res.filled;
        for (const f of res.failed) errors[f.id] = f.reason;
        setProgress({ done: Math.min(i + BATCH, ids.length), total: ids.length });
      }
      const left = Object.keys(errors).length;
      showToast({
        message: left ? `${filled} ta savolga kalit so'z qo'shildi. ${left} tasini qo'lda belgilang.` : `${filled} ta savolga kalit so'z qo'shildi — "Tekshirilmagan" filtrida ko'rib chiqing`,
        tone: left ? "info" : "success",
      });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Bajarib bo'lmadi", tone: "danger" });
    } finally {
      setFailed(errors);
      setProgress(null);
      load();
    }
  }

  const topics = [...new Set(data.items.map((i) => i.topicSlug))];

  return (
    <section className="mb-6 rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:p-5" data-testid="missing-keywords" role="alert">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
        <KeyRoundIcon className="size-5 shrink-0 text-warning" />
        {data.total} ta savolda kalit so&apos;z yo&apos;q yoki to&apos;liq emas
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        O&apos;quvchi javob bergandan keyin har savolda <b>savol kaliti → javob kaliti</b>ni uchala tilda ko&apos;rishi kerak. {topics.length} ta mavzuda yetishmaydi.
        &quot;AI bilan to&apos;ldirish&quot; yetishmaganlarini qo&apos;shadi (mavjudlari o&apos;zgarmaydi), keyin ular &quot;Tekshirilmagan&quot; filtrida ko&apos;rinadi.
      </p>
      <ul className="mt-3 flex max-h-64 flex-col gap-1 overflow-y-auto text-sm" data-testid="missing-keywords-list">
        {data.items.slice(0, SHOWN).map((q) => (
          <li key={q.id} className="min-w-0">
            <Link href={`/admin/questions/${q.id}`} className="text-brand underline-offset-2 hover:underline">
              {q.topicTitle} · {q.order}-savol
            </Link>{" "}
            <span className="text-muted-foreground">— {q.missing.join(", ")}</span>
            {failed[q.id] && <span className="block text-xs text-danger">{failed[q.id]}</span>}
          </li>
        ))}
        {data.total > SHOWN && <li className="text-muted-foreground">… yana {data.total - SHOWN} ta</li>}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={fill} disabled={!ai || progress !== null} data-testid="missing-keywords-fill">
          {progress ? <Spinner className="size-4 text-brand-foreground" /> : <SparklesIcon className="size-4" />}
          {progress ? `To'ldirilmoqda… ${progress.done} / ${progress.total}` : "AI bilan to'ldirish"}
        </Button>
        {!ai && <span className="text-xs text-muted-foreground">AI sozlanmagan — savolni ochib, kalit so&apos;zni qo&apos;lda belgilang.</span>}
      </div>
    </section>
  );
}
