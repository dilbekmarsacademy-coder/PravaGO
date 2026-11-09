"use client";

import { forwardRef, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { formatCertDate, formatPercent } from "@/lib/api/final-exam";
import { certificateFonts } from "./fonts";

// Sertifikat — HTML/CSS (rasm emas): public/certificate-sample.png dizayni
// (A4 landshaft, 1600×1131 asos o'lcham). Joylashuv namunadan o'lchangan;
// ekranda konteyner kengligiga masshtablanadi, PNG — 2x (3200 px).

export const CERT_WIDTH = 1600;
export const CERT_HEIGHT = 1131;

const C = {
  paper: "#fffdf6",
  gold: "#b8901e",
  goldSoft: "#d9b650",
  goldText: "#9a7410",
  navy: "#0b1f44",
  slate: "#4a5670",
};

export interface CertificateData {
  fullName: string;
  questions: number;
  attemptsCount: number;
  averagePercent: number;
  issuedAt: string;
  certificateNumber: string;
}

const poppins: CSSProperties = { fontFamily: "var(--font-cert-poppins), sans-serif" };
const lora: CSSProperties = { fontFamily: "var(--font-cert-lora), serif" };

/** Markazlangan qator: `top` — namunadagi qator yuqorisi (asos px). */
function Line({ top, style, children }: { top: number; style: CSSProperties; children: ReactNode }) {
  return (
    <div style={{ position: "absolute", left: 80, right: 80, top, textAlign: "center", lineHeight: 1, whiteSpace: "nowrap", ...style }}>
      {children}
    </div>
  );
}

/** Uzun ism ramkaga sig'ishi uchun shrift kichrayadi (Lora kursiv ~0,45em/harf). */
function nameFontSize(name: string): number {
  return Math.round(Math.min(68, 1040 / Math.max(1, name.length * 0.45)));
}

/** Sertifikat varag'i — har doim krem qog'oz (dark mode'da ham). */
export const CertificateSheet = forwardRef<HTMLDivElement, { data: CertificateData; className?: string }>(function CertificateSheet({ data, className }, ref) {
  const name = data.fullName || "Ism Familiya";
  return (
    <div
      ref={ref}
      className={cn(certificateFonts, className)}
      data-testid="certificate-sheet"
      style={{ position: "relative", width: CERT_WIDTH, height: CERT_HEIGHT, background: C.paper, color: C.navy, overflow: "hidden", ...lora }}
    >
      {/* Ramka: qalin tashqi va ingichka ichki tilla chiziq. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 28, border: `6px solid ${C.gold}` }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: 50, border: `2px solid ${C.goldSoft}` }} />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo/emblem.png" alt="" width={180} height={180} style={{ position: "absolute", left: (CERT_WIDTH - 180) / 2, top: 89, width: 180, height: 180 }} />

      <Line top={276} style={{ ...poppins, fontSize: 31, fontWeight: 700, letterSpacing: "0.2em" }}>
        <span style={{ color: C.navy }}>PRAVA</span> <span style={{ color: C.goldText }}>ISHONCH</span>
      </Line>

      <Line top={352} style={{ ...poppins, fontSize: 78, fontWeight: 700, letterSpacing: "0.2em", color: C.goldText, paddingLeft: "0.2em" }}>
        SERTIFIKAT
      </Line>

      <Line top={456} style={{ ...lora, fontSize: 27, letterSpacing: "0.2em", color: C.navy, paddingLeft: "0.2em" }}>
        YAKUNIY ICHKI IMTIHON
      </Line>

      <div aria-hidden="true" style={{ position: "absolute", top: 506, left: 579, width: 442, height: 3, background: `linear-gradient(90deg, transparent, ${C.gold} 30%, ${C.gold} 70%, transparent)` }} />

      <Line top={543} style={{ ...poppins, fontSize: 36, fontWeight: 700, color: C.navy }}>
        Tabriklaymiz! Siz ichki imtihondan o&apos;tdingiz
      </Line>

      <Line top={611} style={{ ...lora, fontSize: 25, color: C.slate }}>
        Ushbu sertifikat egasi
      </Line>

      <Line top={733 - nameFontSize(name) * 1.05} style={{ ...lora, fontSize: nameFontSize(name), fontStyle: "italic", fontWeight: 400, color: C.navy, lineHeight: 1.05 }}>
        <span data-testid="certificate-name">{name}</span>
      </Line>

      <div aria-hidden="true" style={{ position: "absolute", top: 739, left: 263, width: 1074, height: 2, background: C.gold }} />

      <div style={{ position: "absolute", left: 120, right: 120, top: 766, textAlign: "center", fontSize: 26, lineHeight: "39px", color: C.navy }}>
        {data.questions} ta savollik yakuniy imtihonni{" "}
        <b style={{ color: C.goldText, fontWeight: 700 }}>{data.attemptsCount} ta urinishda</b> topshirib,
        <br />
        o&apos;rtacha natija <b style={{ color: C.goldText, fontWeight: 700 }} data-testid="certificate-percent">{formatPercent(data.averagePercent)}</b> ni qayd etdi.
      </div>

      <Line top={858} style={{ ...poppins, fontSize: 24, fontWeight: 700, color: C.goldText }}>
        Yakuniy imtihonda sizga omad tilaymiz!
      </Line>

      <Line top={894} style={{ ...poppins, fontSize: 21, fontWeight: 700, color: C.navy, letterSpacing: "0.01em" }}>
        Haydovchilar akademiyasi tomonidan berildi · pravaishonch<span style={{ color: C.goldText }}>.uz</span>
      </Line>

      {/* Muhr */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 928,
          left: (CERT_WIDTH - 136) / 2,
          width: 136,
          height: 136,
          borderRadius: "50%",
          background: `radial-gradient(circle at 38% 30%, #f6df8f 0%, #dcbb56 38%, #c39a2c 72%, #a98317 100%)`,
          boxShadow: `0 0 0 3px ${C.paper}, 0 0 0 5px ${C.gold}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "absolute", inset: 7, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.85)" }} />
        <div style={{ position: "absolute", inset: 11, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.6)" }} />
        <div style={{ ...poppins, fontSize: 11.5, fontWeight: 700, lineHeight: 1.35, color: "#fff", textAlign: "center", letterSpacing: "0.04em", textShadow: "0 1px 1px rgba(120,90,10,0.35)" }}>
          HAYDOVCHILAR
          <br />
          AKADEMIYASI
        </div>
      </div>

      <div style={{ position: "absolute", left: 111, top: 1000, lineHeight: 1 }}>
        <div style={{ ...lora, fontSize: 21, color: C.slate }}>Sana</div>
        <div style={{ ...poppins, fontSize: 21, fontWeight: 700, color: C.navy, marginTop: 8 }} data-testid="certificate-date">
          {formatCertDate(data.issuedAt)}
        </div>
      </div>

      <div style={{ position: "absolute", right: 111, top: 1000, lineHeight: 1, textAlign: "right" }}>
        <div style={{ ...lora, fontSize: 21, color: C.slate }}>Sertifikat raqami</div>
        <div style={{ ...poppins, fontSize: 21, fontWeight: 700, color: C.navy, marginTop: 8 }} data-testid="certificate-number">
          {data.certificateNumber}
        </div>
      </div>
    </div>
  );
});

/**
 * Ekranga sig'adigan sertifikat: konteyner kengligiga masshtablanadi (nisbat
 * 1600:1131 saqlanadi). `sheetRef` — PNG eksport uchun asl (masshtabsiz) varaq.
 */
export function ScaledCertificate({ data, className, sheetRef }: { data: CertificateData; className?: string; sheetRef?: React.Ref<HTMLDivElement> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const update = () => setScale(box.clientWidth / CERT_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={boxRef} className={cn("relative w-full overflow-hidden rounded-sm shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]", className)} style={{ aspectRatio: `${CERT_WIDTH} / ${CERT_HEIGHT}` }}>
      <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}>
        <CertificateSheet ref={sheetRef} data={data} />
      </div>
    </div>
  );
}

/** Chop etish uchun: body'ga portal, faqat @media print'da ko'rinadi (A4 landshaft kengligi 297 mm). */
export function CertificatePrintRoot({ data }: { data: CertificateData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(
    <div id="certificate-print-root" aria-hidden="true">
      <div style={{ transformOrigin: "0 0", transform: `scale(${1122.52 / CERT_WIDTH})` }}>
        <CertificateSheet data={data} />
      </div>
    </div>,
    document.body,
  );
}
