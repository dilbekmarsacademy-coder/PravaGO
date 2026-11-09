"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeftIcon, AwardIcon, RotateCcwIcon } from "lucide-react";
import { EXAM_TYPE_LABEL, formatCertDate, formatPercent, listCertificates, type Certificate } from "@/lib/api/final-exam";
import { AppHeader } from "@/components/shared/AppHeader";
import { Button, buttonClasses } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";

// Sertifikat ko'rinishi, xat va yuklab olish — sahifa ochilgach alohida yuklanadi.
const CertificateViewer = dynamic(() => import("@/components/certificate/CertificateViewer"), {
  ssr: false,
  loading: () => <div className="skeleton-shimmer aspect-[1600/1131] w-full rounded-2xl" />,
});

/** Kabinet: "Sertifikatlar" — yakuniy imtihondan o'tganlik sertifikatlari. */
export default function CertificatesPage() {
  const [items, setItems] = useState<Certificate[] | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(false);
    listCertificates()
      .then((list) => {
        setItems(list);
        setSelected((prev) => prev ?? list[list.length - 1]?.certificateNumber ?? null);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const current = items?.find((c) => c.certificateNumber === selected) ?? null;

  return (
    <>
      <AppHeader>
        <Link href="/kabinet" aria-label="Kabinet" className={buttonClasses({ variant: "secondary", size: "icon", className: "size-11 md:size-10" })}>
          <ArrowLeftIcon className="size-4.5" />
        </Link>
        <span className="truncate text-sm font-semibold text-foreground">Sertifikatlar</span>
      </AppHeader>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">Sertifikatlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Yakuniy ichki imtihondan o&apos;tganingizni tasdiqlovchi sertifikatlar.</p>
        </div>

        {error && (
          <Card role="alert" className="flex flex-col items-center gap-4 p-8 text-center">
            <p className="text-sm text-foreground">Sertifikatlarni yuklab bo&apos;lmadi. Internet aloqasini tekshiring.</p>
            <Button variant="secondary" onClick={load}>
              <RotateCcwIcon className="size-4" />
              Qayta urinish
            </Button>
          </Card>
        )}
        {!items && !error && <div className="skeleton-shimmer h-40 rounded-2xl" />}

        {items && items.length === 0 && (
          <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center" data-testid="certificates-empty">
            <span className="flex size-14 items-center justify-center rounded-full bg-brand/15 text-brand">
              <AwardIcon className="size-6" />
            </span>
            <p className="font-display text-lg font-bold text-foreground">Hozircha sertifikat yo&apos;q</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Yakuniy ichki imtihonning 10 ta urinishini o&apos;rtacha kamida 98% natija bilan topshirsangiz, sertifikat shu yerda paydo bo&apos;ladi.
            </p>
            <Link href="/kabinet/imtihon" className={buttonClasses({ size: "md", className: "mt-2" })}>
              Yakuniy imtihonga o&apos;tish
            </Link>
          </Card>
        )}

        {items && items.length > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2" data-testid="certificate-list">
              {items.map((c) => (
                <button
                  key={c.certificateNumber}
                  type="button"
                  onClick={() => setSelected(c.certificateNumber)}
                  aria-pressed={selected === c.certificateNumber}
                  className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${selected === c.certificateNumber ? "border-brand bg-brand/10" : "border-border bg-card hover:border-brand/50"}`}
                  data-testid="certificate-card"
                >
                  <span className="glow-orange flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-background">
                    <AwardIcon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display font-bold text-foreground">Yakuniy imtihon · {EXAM_TYPE_LABEL[c.examType]}</span>
                    <span className="block text-sm text-muted-foreground">
                      O&apos;rtacha {formatPercent(c.averagePercent)} · {formatCertDate(c.issuedAt)}
                    </span>
                    <span className="block font-mono text-xs text-muted-foreground">{c.certificateNumber}</span>
                  </span>
                </button>
              ))}
            </div>

            {current && (
              <CertificateViewer
                key={current.certificateNumber}
                certificate={current}
                onChange={(next) => setItems((prev) => prev?.map((c) => (c.certificateNumber === next.certificateNumber ? next : c)) ?? prev)}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}
