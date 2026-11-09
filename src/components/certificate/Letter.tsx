"use client";

import { cn } from "@/lib/utils";
import { certificateFonts } from "./fonts";

// Motivatsion xat — sertifikat bilan bir xil krem qog'oz va tilla ranglar
// (dark mode'da ham). Matn serverda yig'ilgan va saqlangan (Certificate.letterText).

export function LetterPaper({ fullName, text, className }: { fullName: string; text: string; className?: string }) {
  const paragraphs = text.split(/\n{2,}/).filter(Boolean);
  return (
    <article
      className={cn(
        certificateFonts,
        "relative mx-auto w-full max-w-2xl rounded-sm bg-[#fffdf6] px-6 py-8 text-[#0b1f44] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] sm:px-12 sm:py-12",
        className,
      )}
      style={{ fontFamily: "var(--font-cert-lora), serif" }}
      data-testid="letter-paper"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-2.5 border-2 border-[#b8901e] sm:inset-3.5" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-4 border border-[#d9b650] sm:inset-5.5" />
      <div className="relative">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/emblem.png" alt="" width={56} height={56} className="size-12 sm:size-14" />
          <p className="text-xs font-bold tracking-[0.2em] sm:text-sm" style={{ fontFamily: "var(--font-cert-poppins), sans-serif" }}>
            PRAVA <span className="text-[#9a7410]">ISHONCH</span>
          </p>
        </div>
        <p className="mt-6 text-xl italic sm:text-2xl">Hurmatli {fullName || "o'quvchi"}!</p>
        <div className="mt-4 flex flex-col gap-3.5 text-[0.98rem] leading-relaxed sm:text-[1.05rem]">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-8 h-px w-40 bg-gradient-to-r from-[#b8901e] to-transparent" />
        <p className="mt-3 italic">Hurmat bilan,</p>
        <p className="font-semibold" style={{ fontFamily: "var(--font-cert-poppins), sans-serif" }}>
          Haydovchilar akademiyasi jamoasi
        </p>
        <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-cert-poppins), sans-serif" }}>
          pravaishonch<span className="text-[#9a7410]">.uz</span>
        </p>
      </div>
    </article>
  );
}
