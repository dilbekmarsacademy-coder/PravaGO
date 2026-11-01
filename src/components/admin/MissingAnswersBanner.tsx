"use client";

// Ogohlantirish: manbada to'g'ri javobi belgilanmagan savollar ("javob kutilmoqda").
// Admin javoblarni belgilaydi, keyin "Tugatdim" — belgilanganlari bir martada
// saytga chiqadi (o'quvchi testida paydo bo'ladi). Kutilayotgan savol qolmasa — blok yo'qoladi.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2Icon, RocketIcon, TriangleAlertIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { Spinner } from "@/components/admin/ui";

interface PendingTopic {
  slug: string;
  day: number;
  order: number;
  title: string;
  total: number;
  answered: number;
}

interface PendingSummary {
  total: number;
  answered: number;
  topics: PendingTopic[];
}

export default function MissingAnswersBanner() {
  const [data, setData] = useState<PendingSummary | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminFetch<PendingSummary>("content/pending")
      .then(setData)
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data || data.total === 0) return null;
  const left = data.total - data.answered;
  const days = [...new Set(data.topics.map((t) => t.day))];

  async function publish() {
    setBusy(true);
    try {
      const res = await adminFetch<{ published: number; remaining: number }>("content/pending/publish", { method: "POST" });
      showToast({
        message: res.remaining > 0 ? `${res.published} ta savol saytga chiqdi. ${res.remaining} tasi hali javobsiz.` : `${res.published} ta savol saytga chiqdi — testlar to'liq`,
        tone: "success",
      });
      setConfirming(false);
      load();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Bajarib bo'lmadi", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:p-5" data-testid="missing-answers" role="alert">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
        <TriangleAlertIcon className="size-5 shrink-0 text-warning" />
        Quyidagi kunlarda testlarning javoblari qo&apos;shilmagan
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Mavzuni ochib, har bir savolning to&apos;g&apos;ri javobini belgilang. Belgilangan:{" "}
        <b className="text-foreground" data-testid="pending-progress">
          {data.answered} / {data.total}
        </b>
        . Hammasi tugagach <b>&quot;Tugatdim&quot;</b> tugmasini bosing — savollar to&apos;g&apos;ri javoblari bilan bir martada saytga chiqadi. Ungacha
        o&apos;quvchiga ko&apos;rinmaydi.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {days.map((day) => (
          <li key={day} className="text-sm">
            <span className="font-semibold text-foreground">{day}-kun:</span>{" "}
            {data.topics
              .filter((t) => t.day === day)
              .map((t, i) => (
                <span key={t.slug}>
                  {i > 0 && ", "}
                  <Link href={`/admin/content/${t.slug}?filter=pending`} className="text-brand underline-offset-2 hover:underline">
                    {t.order}-mavzu {t.title !== t.slug ? `«${t.title}»` : ""} — {t.answered}/{t.total}
                  </Link>
                  {t.answered === t.total && <CheckCircle2Icon className="ml-1 inline size-3.5 text-success" aria-label="hammasi belgilangan" />}
                </span>
              ))}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <span className="text-sm text-foreground">
              {left > 0
                ? `${data.answered} ta belgilangan savol saytga chiqadi, ${left} tasi hali javobsiz qoladi. Davom etasizmi?`
                : `${data.total} ta savol saytga chiqadi. Davom etasizmi?`}
            </span>
            <Button size="sm" onClick={publish} disabled={busy} data-testid="pending-publish-confirm">
              {busy ? <Spinner className="size-4 text-brand-foreground" /> : <RocketIcon className="size-4" />} Ha, saytga chiqarish
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Bekor
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => setConfirming(true)} disabled={data.answered === 0} data-testid="pending-publish">
            <CheckCircle2Icon className="size-4" /> Tugatdim — saytga chiqarish
          </Button>
        )}
        {data.answered === 0 && <span className="text-xs text-muted-foreground">Avval kamida bitta savolning javobini belgilang.</span>}
      </div>
    </section>
  );
}
