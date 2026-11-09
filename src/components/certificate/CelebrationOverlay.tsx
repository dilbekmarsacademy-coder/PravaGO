"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRightIcon, HeartHandshakeIcon } from "lucide-react";
import { markCertificateCelebrated, setCertificateName, type Certificate } from "@/lib/api/final-exam";
import { Button } from "@/components/shared/Button";
import { ScaledCertificate } from "./Certificate";
import { LetterPaper } from "./Letter";

// Tabrik oqimi (to'liq ekran): [ism so'rash] → motivatsion xat → "Davom etish" →
// konfetti + sertifikat → "Rahmat". Sertifikat backendda allaqachon saqlangan:
// sahifa yopilsa ham yo'qolmaydi, ko'rilmagan bo'lsa keyingi kirishda yana chiqadi.

type Stage = "name" | "letter" | "certificate";

const GOLD = ["#d9b650", "#b8901e", "#f6df8f", "#9a7410"];
const BLUE = ["#2563eb", "#60a5fa", "#0b1f44"];

/** Bayram effekti: tepadan konfetti yomg'iri + ikki pastki burchakdan zarbalar (~3,5 s). */
async function fireConfetti(reduced: boolean): Promise<() => void> {
  const confetti = (await import("canvas-confetti")).default;
  const colors = [...GOLD, ...BLUE];
  if (reduced) {
    // Harakat kamaytirilgan: bitta yengil, sekin zarb.
    confetti({ particleCount: 40, spread: 70, startVelocity: 18, gravity: 0.6, ticks: 120, origin: { y: 0.4 }, colors, disableForReducedMotion: false });
    return () => confetti.reset();
  }
  const end = Date.now() + 3500;
  const burst = (x: number, angle: number) =>
    confetti({ particleCount: 90, angle, spread: 60, startVelocity: 70, gravity: 1, ticks: 260, origin: { x, y: 1 }, colors, zIndex: 120 });
  burst(0, 60);
  burst(1, 120);
  const sides = setTimeout(() => {
    burst(0.05, 65);
    burst(0.95, 115);
  }, 900);
  let frame = 0;
  const rain = () => {
    confetti({ particleCount: 3, startVelocity: 0, gravity: 0.7, ticks: 320, origin: { x: Math.random(), y: -0.05 }, scalar: 1.1, drift: Math.random() - 0.5, colors, zIndex: 120 });
    confetti({ particleCount: 1, angle: 90, spread: 30, startVelocity: 25, origin: { x: Math.random(), y: 1 }, colors, zIndex: 120 });
    if (Date.now() < end) frame = requestAnimationFrame(rain);
  };
  frame = requestAnimationFrame(rain);
  return () => {
    clearTimeout(sides);
    cancelAnimationFrame(frame);
    confetti.reset();
  };
}

export interface CelebrationOverlayProps {
  certificate: Certificate;
  /** Xatdan boshlash (standart) yoki to'g'ridan sertifikatdan. */
  startWith?: "letter" | "certificate";
  /** "Rahmat" bosildi (sertifikat "ko'rildi" deb belgilangan). */
  onDone: (certificate: Certificate) => void;
}

export default function CelebrationOverlay({ certificate: initial, startWith = "letter", onDone }: CelebrationOverlayProps) {
  const reduced = Boolean(useReducedMotion());
  const [certificate, setCertificate] = useState(initial);
  const [stage, setStage] = useState<Stage>(initial.fullName ? startWith : "name");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const stopConfetti = useRef<(() => void) | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      stopConfetti.current?.();
    };
  }, []);

  useEffect(() => {
    if (stage !== "certificate") return;
    let cancelled = false;
    fireConfetti(reduced).then((stop) => {
      if (cancelled) stop();
      else stopConfetti.current = stop;
    });
    return () => {
      cancelled = true;
    };
  }, [stage, reduced]);

  async function saveName() {
    const value = name.trim().replace(/\s+/g, " ");
    if (value.length < 3 || !value.includes(" ")) {
      setError("Ism va familiyangizni to'liq kiriting (masalan: Aziza Karimova).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await setCertificateName(certificate.certificateNumber, value);
      setCertificate(next);
      setStage(startWith);
    } catch {
      setError("Saqlab bo'lmadi. Internet aloqasini tekshirib, qayta urinib ko'ring.");
    } finally {
      setSaving(false);
    }
  }

  const finish = useCallback(() => {
    stopConfetti.current?.();
    markCertificateCelebrated(certificate.certificateNumber).catch(() => undefined);
    onDone({ ...certificate, celebrated: true });
  }, [certificate, onDone]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={stage === "certificate" ? "Sertifikat" : "Tabrik xati"}
      className="fixed inset-0 z-[100] overflow-y-auto bg-[#050811]/85 backdrop-blur-md"
      data-testid="celebration-overlay"
    >
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-8 sm:px-8">
        <AnimatePresence mode="wait">
          {stage === "name" && (
            <motion.div key="name" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="w-full max-w-md">
              <div className="rounded-2xl border border-white/10 bg-[#fffdf6] p-6 text-[#0b1f44] sm:p-8">
                <p className="text-lg font-bold">Sertifikatdagi ismingiz</p>
                <p className="mt-1 text-sm text-[#4a5670]">Profilingizda ism ko&apos;rsatilmagan. Sertifikatda qanday yozilishi kerak? Keyin o&apos;zgartirib bo&apos;lmaydi.</p>
                <form
                  className="mt-4 flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveName();
                  }}
                >
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    maxLength={120}
                    placeholder="Ism Familiya"
                    className="h-12 rounded-xl border border-[#d9b650] bg-white px-4 text-base outline-none focus:ring-2 focus:ring-[#b8901e]"
                    data-testid="certificate-name-input"
                  />
                  {error && <p className="text-sm text-red-700">{error}</p>}
                  <Button type="submit" size="lg" disabled={saving}>
                    Saqlash
                  </Button>
                </form>
              </div>
            </motion.div>
          )}

          {stage === "letter" && (
            <motion.div key="letter" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.45, ease: "easeOut" }} className="flex w-full flex-col items-center gap-6">
              <LetterPaper fullName={certificate.fullName} text={certificate.letterText} />
              <Button size="lg" onClick={() => setStage("certificate")} data-testid="letter-continue">
                Davom etish
                <ArrowRightIcon className="size-4" />
              </Button>
            </motion.div>
          )}

          {stage === "certificate" && (
            <motion.div key="certificate" className="flex w-full flex-col items-center gap-6">
              <motion.div
                className="w-full"
                // Sertifikat va "Rahmat" tugmasi har doim bitta ekranga sig'adi: kenglik ekran
                // balandligidan (nisbat 1600:1131) va 52rem dan oshmaydi.
                style={{ maxWidth: "min(52rem, calc((100dvh - 11rem) * 1.4147))" }}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotate: -6 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={reduced ? { duration: 0.3 } : { delay: 0.5, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              >
                <ScaledCertificate data={certificate} />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0.2 : 1.4 }}>
                <Button size="lg" onClick={finish} data-testid="celebration-thanks" className="min-w-44">
                  <HeartHandshakeIcon className="size-4" />
                  Rahmat
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}
