"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2Icon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";

interface QuestionImageProps {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  /** "test" — test sahifasi (ustuvor yuklash); "card" — ro'yxatdagi karta (kichikroq, lazy). */
  variant?: "test" | "card";
}

// O'lcham noma'lum bo'lsa (eski backend) — eng ko'p uchraydigan nisbat.
const FALLBACK_WIDTH = 900;
const FALLBACK_HEIGHT = 506;

/**
 * Savol rasmi: o'lchamlar oldindan ma'lum bo'lgani uchun joy ajratiladi (layout
 * shift yo'q), yuklanguncha shimmer, bosilganda to'liq ekran lightbox.
 *
 * Ekranga moslashish: rasm balandligi `--img-max-h` dan oshmaydi (bir ustunda
 * ekranning ~42%, ikki ustunda header'dan qolgan joy). Ramka rasm nisbatiga
 * qarab torayadi — rasm doim ramkani to'liq to'ldiradi, bo'sh polosa qolmaydi.
 */
export function QuestionImage({ src, alt, width, height, variant = "test" }: QuestionImageProps) {
  const { t } = useLocale();
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const w = width ?? FALLBACK_WIDTH;
  const h = height ?? FALLBACK_HEIGHT;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.testSession.zoomImage}
        style={{ maxWidth: `calc(var(--img-max-h) * ${w / h})` }}
        className={cn(
          "group relative mx-auto block w-full cursor-zoom-in overflow-hidden rounded-md bg-surface-2 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          variant === "test"
            ? "[--img-max-h:42dvh] twocol:[--img-max-h:clamp(14rem,calc(100dvh-9rem),640px)]"
            : "[--img-max-h:min(40dvh,22rem)]",
        )}
      >
        {!loaded && <span className="skeleton-shimmer absolute inset-0" aria-hidden="true" />}
        <Image
          src={src}
          alt={alt}
          width={w}
          height={h}
          // Asl fayl uzatiladi: rasmlar kichik (≤900px), qayta siqish (standart
          // 75% sifat) ularni xiralashtirib yuboradi.
          unoptimized
          loading={variant === "test" ? "eager" : "lazy"}
          fetchPriority={variant === "test" ? "high" : "auto"}
          onLoad={() => setLoaded(true)}
          className={cn("block h-auto w-full transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-full bg-background/75 text-foreground backdrop-blur transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-visible:opacity-100"
        >
          <Maximize2Icon className="size-4" />
        </span>
      </button>

      <ImageLightbox open={open} onClose={() => setOpen(false)} src={src} alt={alt} width={w} height={h} />
    </>
  );
}

interface ImageLightboxProps {
  open: boolean;
  onClose: () => void;
  src: string;
  alt: string;
  width: number;
  height: number;
}

function ImageLightbox({ open, onClose, src, alt, width, height }: ImageLightboxProps) {
  const { t } = useLocale();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-3 backdrop-blur-md sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={onClose}
        >
          {/* touch-action: pinch-zoom — telefonda barmoqlar bilan kattalashtirish. */}
          <motion.div
            className="relative touch-pinch-zoom"
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={src}
              alt={alt}
              width={width}
              height={height}
              unoptimized
              // Ekranga sig'adigan eng katta o'lcham, nisbat saqlanadi.
              style={{ width: `min(94vw, calc(88dvh * ${width / height}))` }}
              className="h-auto rounded-md shadow-card"
            />
          </motion.div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.testSession.closeImage}
            className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 flex size-11 items-center justify-center rounded-full border border-border bg-background/80 text-foreground outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-brand"
          >
            <XIcon className="size-5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
