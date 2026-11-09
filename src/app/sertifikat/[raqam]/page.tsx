"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheckIcon, SearchXIcon } from "lucide-react";
import { EXAM_TYPE_LABEL, formatCertDate, formatPercent, verifyCertificate, type PublicCertificate } from "@/lib/api/final-exam";
import { AppHeader, BrandMark } from "@/components/shared/AppHeader";
import { Card } from "@/components/shared/Card";

/** Ommaviy tekshirish: sertifikat haqiqiymi (ism, natija, sana). Qidiruvda ko'rinmaydi (layout — noindex). */
export default function CertificateVerifyPage({ params }: { params: Promise<{ raqam: string }> }) {
  const { raqam } = use(params);
  const number = decodeURIComponent(raqam).toUpperCase();
  const [state, setState] = useState<{ status: "loading" } | { status: "found"; data: PublicCertificate } | { status: "missing" } | { status: "error" }>({ status: "loading" });

  useEffect(() => {
    verifyCertificate(number)
      .then((data) => setState(data ? { status: "found", data } : { status: "missing" }))
      .catch(() => setState({ status: "error" }));
  }, [number]);

  return (
    <>
      <AppHeader>
        <Link href="/" aria-label="Bosh sahifa" className="flex items-center">
          <BrandMark />
        </Link>
        <span className="truncate text-sm font-semibold text-foreground">Sertifikatni tekshirish</span>
      </AppHeader>
      <main className="mx-auto w-full max-w-lg px-4 py-10">
        {state.status === "loading" && <div className="skeleton-shimmer h-56 rounded-2xl" />}
        {state.status === "found" && (
          <Card className="flex flex-col items-center gap-4 p-8 text-center" data-testid="verify-found">
            <span className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
              <BadgeCheckIcon className="size-7" />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-foreground">Sertifikat haqiqiy</p>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{state.data.certificateNumber}</p>
            </div>
            <dl className="grid w-full gap-2 text-left text-sm">
              <Row label="Egasi" value={state.data.fullName || "—"} />
              <Row label="Imtihon" value={`Yakuniy ichki imtihon · ${EXAM_TYPE_LABEL[state.data.examType]}`} />
              <Row label="O'rtacha natija" value={`${formatPercent(state.data.averagePercent)} (${state.data.attemptsCount} ta urinish)`} />
              <Row label="Berilgan sana" value={formatCertDate(state.data.issuedAt)} />
            </dl>
            <p className="text-xs text-muted-foreground">Haydovchilar akademiyasi · pravaishonch.uz</p>
          </Card>
        )}
        {(state.status === "missing" || state.status === "error") && (
          <Card className="flex flex-col items-center gap-3 p-8 text-center" data-testid="verify-missing">
            <span className="flex size-14 items-center justify-center rounded-full bg-danger/15 text-danger">
              <SearchXIcon className="size-7" />
            </span>
            <p className="font-display text-lg font-bold text-foreground">{state.status === "missing" ? "Sertifikat topilmadi" : "Tekshirib bo'lmadi"}</p>
            <p className="text-sm text-muted-foreground">
              {state.status === "missing" ? `"${number}" raqamli sertifikat mavjud emas.` : "Internet aloqasini tekshirib, sahifani yangilang."}
            </p>
          </Card>
        )}
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-xl border border-border bg-foreground/[0.03] px-3 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}
