"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, AwardIcon, ChevronRightIcon, FlagIcon, LockIcon, PlayIcon, RotateCcwIcon, TimerIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXAM_TYPE_LABEL, formatPercent, getFinalExamOverview, type FinalExamOverview, type TypeOverview } from "@/lib/api/final-exam";
import { formatDateTime } from "@/lib/test/timer";
import { AppHeader } from "@/components/shared/AppHeader";
import { Badge } from "@/components/shared/Badge";
import { Button, buttonClasses } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { StartExamDialog } from "@/components/final-exam/StartExamDialog";

/** Yakuniy ichki imtihon: ikki tur (20/50), urinishlar, o'rtacha va natija. */
export default function FinalExamHubPage() {
  const [data, setData] = useState<FinalExamOverview | null>(null);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(() => {
    setError(false);
    getFinalExamOverview()
      .then(setData)
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <>
      <AppHeader>
        <Link href="/kabinet" aria-label="Kabinet" className={buttonClasses({ variant: "secondary", size: "icon", className: "size-11 md:size-10" })}>
          <ArrowLeftIcon className="size-4.5" />
        </Link>
        <span className="truncate text-sm font-semibold text-foreground">Yakuniy ichki imtihon</span>
      </AppHeader>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
        {error && (
          <Card role="alert" className="flex flex-col items-center gap-4 p-8 text-center">
            <p className="text-sm text-foreground">Ma&apos;lumotni yuklab bo&apos;lmadi. Internet aloqasini tekshiring.</p>
            <Button variant="secondary" onClick={load}>
              <RotateCcwIcon className="size-4" />
              Qayta urinish
            </Button>
          </Card>
        )}
        {!data && !error && <div className="skeleton-shimmer h-64 rounded-2xl" />}

        {data && (
          <>
            <Card className="relative overflow-hidden border-brand/40 bg-gradient-to-br from-brand/10 via-transparent to-info/5 p-6">
              <span className="font-mono text-[0.65rem] font-bold tracking-[0.2em] text-brand uppercase">7-kun</span>
              <h1 className="mt-1 font-display text-xl font-bold text-foreground sm:text-2xl">Yakuniy ichki imtihon</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Savollar 1–6-kun mavzu testlaridan ({data.poolSize} ta) tanlanadi. Har bir tur uchun 10 ta urinish beriladi. 10 ta urinishning o&apos;rtachasi kamida{" "}
                {data.passAverage}% bo&apos;lsa — ichki imtihondan o&apos;tasiz va sertifikat olasiz.
              </p>
              {data.unlocked ? (
                <Button size="lg" className="mt-5 w-full sm:w-auto" onClick={() => setDialogOpen(true)} data-testid="hub-start">
                  <FlagIcon className="size-4" />
                  Imtihonni boshlash
                </Button>
              ) : (
                <p className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-foreground/80">
                  <LockIcon className="size-4 shrink-0 text-brand" />
                  Imtihon 1–6-kunlarning barcha mavzulari tugagach ochiladi (qolgan: {data.remainingTopics} ta mavzu).
                </p>
              )}
            </Card>

            {data.types.map((type) => (
              <TypeCard key={type.type} type={type} />
            ))}

            <StartExamDialog open={dialogOpen} onOpenChange={setDialogOpen} overview={data} />
          </>
        )}
      </main>
    </>
  );
}

function TypeCard({ type }: { type: TypeOverview }) {
  const finished = type.attempts.filter((a) => a.status !== "IN_PROGRESS");
  return (
    <Card className="p-5 sm:p-6" data-testid={`hub-type-${type.type}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">{EXAM_TYPE_LABEL[type.type]}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <TimerIcon className="size-3.5" /> {type.questions} ta savol · {type.minutes} daqiqa
          </p>
        </div>
        {type.outcome === "passed" ? (
          <Badge tone="success">O&apos;tdingiz</Badge>
        ) : type.outcome === "failed" ? (
          <Badge tone="warning">O&apos;tilmadi</Badge>
        ) : (
          <Badge tone="muted">{type.attemptsLeft} ta urinish qoldi</Badge>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-border bg-foreground/[0.03] px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">Urinishlar</dt>
          <dd className="mt-0.5 font-mono text-lg font-bold text-foreground tabular-nums">
            {type.attemptsUsed}/{type.maxAttempts}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-foreground/[0.03] px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">Hozirgi o&apos;rtacha</dt>
          <dd className={cn("mt-0.5 font-mono text-lg font-bold tabular-nums", type.average !== null && type.average >= 98 ? "text-success" : "text-foreground")}>
            {type.average !== null ? formatPercent(type.average) : "—"}
          </dd>
        </div>
      </dl>

      {/* Urinishlar bo'yicha foizlar (10 ta katak). */}
      <ol className="mt-4 grid grid-cols-5 gap-1.5 sm:grid-cols-10" aria-label="Urinishlar natijasi">
        {Array.from({ length: type.maxAttempts }, (_, i) => {
          const a = type.attempts[i];
          const href = a ? `/test/imtihon/${a.id}` : undefined;
          const label = !a ? "—" : a.status === "IN_PROGRESS" ? "…" : formatPercent(a.percent ?? 0);
          const tone = !a ? "empty" : a.status === "IN_PROGRESS" ? "active" : (a.percent ?? 0) >= 98 ? "good" : "low";
          const cell = (
            <span
              className={cn(
                "flex h-11 flex-col items-center justify-center rounded-lg border font-mono text-[0.7rem] font-bold tabular-nums",
                tone === "empty" && "border-dashed border-border text-muted-foreground/60",
                tone === "active" && "border-brand bg-brand/10 text-brand",
                tone === "good" && "border-success/40 bg-success/10 text-success",
                tone === "low" && "border-warning/40 bg-warning/10 text-warning",
              )}
            >
              <span className="text-[0.55rem] font-medium opacity-70">{i + 1}</span>
              {label}
            </span>
          );
          return <li key={i}>{href ? <Link href={href}>{cell}</Link> : cell}</li>;
        })}
      </ol>

      {type.active && (
        <Link href={`/test/imtihon/${type.active.id}`} className={buttonClasses({ size: "md", className: "mt-4 w-full" })}>
          <PlayIcon className="size-4" />
          Tugallanmagan urinishni davom ettirish
        </Link>
      )}

      {type.outcome === "passed" && type.certificate && (
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-success/40 bg-success/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AwardIcon className="size-4 text-success" />
            Sertifikat: {type.certificate.certificateNumber}
          </p>
          <Link href="/kabinet/sertifikatlar" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Ko&apos;rish <ChevronRightIcon className="size-4" />
          </Link>
        </div>
      )}

      {type.outcome === "failed" && (
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning/[0.06] p-4" data-testid={`hub-failed-${type.type}`}>
          <p className="text-sm font-semibold text-foreground">
            O&apos;rtacha natija {type.average !== null ? formatPercent(type.average) : "—"}. O&apos;tish uchun kamida 98% kerak.
          </p>
          {type.failureNote && <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{type.failureNote}</p>}
        </div>
      )}

      {finished.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Oxirgi urinish: {formatDateTime(finished[finished.length - 1].startedAt)}</p>
      )}
    </Card>
  );
}
