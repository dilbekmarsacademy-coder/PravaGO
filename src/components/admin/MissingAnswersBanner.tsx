"use client";

// Ogohlantirish: to'g'ri javobi belgilanmagan savollar (manbada belgilanmagan,
// javobsiz holda import qilingan). Bunday savol o'quvchiga ko'rinmaydi —
// admin javobni belgilashi bilan testga o'zi qo'shiladi.

import { useEffect, useState } from "react";
import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";

interface DayRow {
  day: number;
  topics: { slug: string; order: number; title: string; titleCyrl: string | null; noCorrectCount: number }[];
}

export default function MissingAnswersBanner() {
  const [days, setDays] = useState<DayRow[] | null>(null);

  useEffect(() => {
    adminFetch<DayRow[]>("content/days")
      .then(setDays)
      .catch(() => setDays(null));
  }, []);

  const rows = (days ?? [])
    .map((d) => ({ day: d.day, topics: d.topics.filter((t) => t.noCorrectCount > 0) }))
    .filter((d) => d.topics.length > 0);
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, d) => sum + d.topics.reduce((s, t) => s + t.noCorrectCount, 0), 0);

  return (
    <section className="mb-6 rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:p-5" data-testid="missing-answers" role="alert">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
        <TriangleAlertIcon className="size-5 shrink-0 text-warning" />
        Quyidagi kunlarda testlarning javoblari qo&apos;shilmagan ({total} ta savol)
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Mavzuni ochib, har bir savolning to&apos;g&apos;ri javobini belgilang. Javobi belgilanmagan savol o&apos;quvchiga ko&apos;rinmaydi va natijaga
        ta&apos;sir qilmaydi; belgilashingiz bilan testga avtomatik qo&apos;shiladi.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((d) => (
          <li key={d.day} className="text-sm">
            <span className="font-semibold text-foreground">{d.day}-kun:</span>{" "}
            {d.topics.map((t, i) => (
              <span key={t.slug}>
                {i > 0 && ", "}
                <Link href={`/admin/content/${t.slug}?filter=noCorrect`} className="text-brand underline-offset-2 hover:underline">
                  {t.order}-mavzu {t.title !== t.slug ? `«${t.title}»` : ""} — {t.noCorrectCount} ta
                </Link>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
