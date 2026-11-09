"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AwardIcon, ChevronRightIcon, FlagIcon, LockIcon } from "lucide-react";
import type { ExamStatus } from "@/components/home/types";
import { FINAL_EXAM_FLOW_ENABLED } from "@/config/rules";
import { EXAM_TYPE_LABEL, formatPercent, getCertificate, getFinalExamOverview, type Certificate, type FinalExamOverview } from "@/lib/api/final-exam";
import { useLocale } from "@/lib/i18n/useLocale";
import { cn } from "@/lib/utils";
import { Card } from "@/components/shared/Card";
import { Badge } from "@/components/shared/Badge";
import { Button, buttonClasses } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { StartExamDialog } from "@/components/final-exam/StartExamDialog";

// Tabrik oqimi (xat, konfetti, sertifikat) — faqat kerak bo'lganda yuklanadi.
const CelebrationOverlay = dynamic(() => import("@/components/certificate/CelebrationOverlay"), { ssr: false });

interface FinalExamCardProps {
  examStatus: ExamStatus;
  attemptsUsed: number;
  maxAttempts: number;
  /** Kabinetdagi hisob (server javobi kelguncha); qaror — serverda. */
  unlocked: boolean;
  /** Savollar bazasi — 1–6-kunlardagi barcha mavzular savollari yig'indisi. */
  poolSize: number;
}

export default function FinalExamCard({ unlocked: localUnlocked, poolSize }: FinalExamCardProps) {
  const { t } = useLocale();
  const router = useRouter();
  const labels = t.kabinet.finalExam;
  const [overview, setOverview] = useState<FinalExamOverview | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [celebrate, setCelebrate] = useState<Certificate | null>(null);

  const load = useCallback(() => {
    getFinalExamOverview()
      .then(async (data) => {
        setOverview(data);
        // Sertifikat berilgan, lekin tabrik ekrani ko'rilmagan (sahifa yopilgan) — qayta ko'rsatamiz.
        const pendingCert = data.types.find((x) => x.certificate && !x.certificate.celebrated)?.certificate;
        if (pendingCert) setCelebrate(await getCertificate(pendingCert.certificateNumber));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
     
    load();
  }, [load]);

  const unlocked = overview ? overview.unlocked : localUnlocked;
  const isAvailable = FINAL_EXAM_FLOW_ENABLED && unlocked;

  return (
    <Card
      className="relative overflow-hidden border-brand/40 bg-gradient-to-br from-brand/10 via-transparent to-info/5 px-5 py-5 shadow-[0_0_32px_-12px_var(--brand)]"
      aria-disabled={!isAvailable}
      data-testid="final-exam-card"
    >
      <div className="pointer-events-none absolute -top-20 -right-16 h-44 w-44 rounded-full bg-brand/20 blur-[80px]" aria-hidden="true" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full",
              isAvailable ? "glow-orange bg-gradient-to-br from-brand to-brand-2 text-background" : "bg-brand/15 text-brand",
            )}
          >
            {isAvailable ? <FlagIcon className="size-5" /> : <LockIcon className="size-5" />}
          </span>
          <div className="min-w-0">
            <span className="font-mono text-[0.65rem] font-bold tracking-[0.2em] text-brand uppercase">{labels.badge}</span>
            <p className="font-display text-base font-bold text-foreground sm:text-lg">{labels.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {labels.pool(overview?.poolSize ?? poolSize)} &middot; 20 ta savol — 25 daqiqa / 50 ta savol — 45 daqiqa
            </p>
            {!unlocked && <p className="mt-2 text-xs text-foreground/70">{labels.lockedHint}</p>}
          </div>
        </div>

        <Badge tone={isAvailable ? "success" : "muted"}>{isAvailable ? labels.open : labels.locked}</Badge>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2.5" data-testid="final-exam-counters">
        {(overview?.types ?? []).map((type) => (
          <div key={type.type} className="rounded-xl border border-border bg-background/40 px-3 py-2.5">
            <p className="text-xs font-semibold text-foreground">{EXAM_TYPE_LABEL[type.type]}</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
              Urinishlar: {type.attemptsUsed}/{type.maxAttempts}
            </p>
            <p className="text-xs text-muted-foreground">
              {type.outcome === "passed" ? (
                <span className="inline-flex items-center gap-1 font-semibold text-success">
                  <AwardIcon className="size-3.5" /> O&apos;tdingiz
                </span>
              ) : type.average !== null ? (
                `O'rtacha: ${formatPercent(type.average)}`
              ) : (
                "—"
              )}
            </p>
          </div>
        ))}
        {!overview &&
          (["Q20", "Q50"] as const).map((k) => (
            <div key={k} className="rounded-xl border border-border bg-background/40 px-3 py-2.5">
              <p className="text-xs font-semibold text-foreground">{EXAM_TYPE_LABEL[k]}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">Urinishlar: 0/10</p>
            </div>
          ))}
      </div>

      {isAvailable && overview && (
        <div className="relative mt-4 flex flex-col gap-2 sm:flex-row">
          <Button size="md" className="flex-1" onClick={() => setDialogOpen(true)} data-testid="final-exam-start">
            <FlagIcon className="size-4" />
            Imtihonni boshlash
          </Button>
          <Link href="/kabinet/imtihon" className={buttonClasses({ variant: "secondary", size: "md", className: "flex-1" })}>
            Natijalar
            <ChevronRightIcon className="size-4" />
          </Link>
        </div>
      )}

      {overview && <StartExamDialog open={dialogOpen} onOpenChange={setDialogOpen} overview={overview} />}

      {celebrate && (
        <CelebrationOverlay
          certificate={celebrate}
          onDone={() => {
            setCelebrate(null);
            showToast({ tone: "success", message: "Sertifikat kabinetingizdagi “Sertifikatlar” bo'limiga saqlandi", action: { label: "Ko'rish", href: "/kabinet/sertifikatlar" } });
            router.push("/kabinet/sertifikatlar");
          }}
        />
      )}
    </Card>
  );
}
