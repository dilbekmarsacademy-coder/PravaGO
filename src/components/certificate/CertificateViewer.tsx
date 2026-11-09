"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DownloadIcon, MailOpenIcon, PartyPopperIcon, PrinterIcon, XIcon } from "lucide-react";
import type { Certificate } from "@/lib/api/final-exam";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { showToast } from "@/components/shared/Toast";
import CelebrationOverlay from "./CelebrationOverlay";
import { CertificatePrintRoot, ScaledCertificate } from "./Certificate";
import { downloadCertificatePng, printCertificate } from "./export";
import { LetterPaper } from "./Letter";

/** Kabinet "Sertifikatlar": to'liq sertifikat, xat, PNG (3200 px) va chop etish/PDF. */
export default function CertificateViewer({ certificate, onChange }: { certificate: Certificate; onChange: (c: Certificate) => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [letterOpen, setLetterOpen] = useState(false);
  const [replay, setReplay] = useState<"letter" | "certificate" | null>(certificate.fullName ? null : "certificate");
  const [downloading, setDownloading] = useState(false);

  async function download() {
    if (!sheetRef.current) return;
    setDownloading(true);
    try {
      await downloadCertificatePng(sheetRef.current, certificate.certificateNumber);
    } catch {
      showToast({ tone: "danger", message: "Rasmni tayyorlab bo'lmadi. Qayta urinib ko'ring yoki \"Chop etish / PDF\"dan foydalaning." });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-3 sm:p-5" data-testid="certificate-viewer">
      <ScaledCertificate data={certificate} sheetRef={sheetRef} />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button variant="secondary" size="md" onClick={() => setLetterOpen(true)} data-testid="read-letter">
          <MailOpenIcon className="size-4" />
          Xatni o&apos;qish
        </Button>
        <Button size="md" onClick={download} disabled={downloading} data-testid="download-png">
          <DownloadIcon className="size-4" />
          {downloading ? "Tayyorlanmoqda…" : "PNG sifatida yuklab olish"}
        </Button>
        <Button variant="secondary" size="md" onClick={printCertificate} data-testid="print-certificate">
          <PrinterIcon className="size-4" />
          Chop etish / PDF
        </Button>
        <Button variant="ghost" size="md" onClick={() => setReplay("letter")}>
          <PartyPopperIcon className="size-4" />
          Tabrikni qayta ko&apos;rish
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Haqiqiyligini tekshirish havolasi:{" "}
        <a className="font-mono text-brand underline-offset-2 hover:underline" href={`/sertifikat/${certificate.certificateNumber}`} target="_blank" rel="noreferrer">
          pravaishonch.uz/sertifikat/{certificate.certificateNumber}
        </a>
      </p>

      <CertificatePrintRoot data={certificate} />
      {letterOpen && <LetterDialog certificate={certificate} onClose={() => setLetterOpen(false)} />}
      {replay && (
        <CelebrationOverlay
          certificate={certificate}
          startWith={replay}
          onDone={(next) => {
            setReplay(null);
            onChange(next);
          }}
        />
      )}
    </Card>
  );
}

function LetterDialog({ certificate, onClose }: { certificate: Certificate; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Tabrik xati" className="fixed inset-0 z-[100] overflow-y-auto bg-[#050811]/85 backdrop-blur-md" onClick={onClose}>
      <div className="flex min-h-full flex-col items-center justify-center gap-5 px-4 py-8" onClick={(e) => e.stopPropagation()}>
        <LetterPaper fullName={certificate.fullName} text={certificate.letterText} />
        <Button variant="secondary" size="md" onClick={onClose} autoFocus>
          <XIcon className="size-4" />
          Yopish
        </Button>
      </div>
    </div>,
    document.body,
  );
}
