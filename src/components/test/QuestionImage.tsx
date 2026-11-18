"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Maximize2Icon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";

interface QuestionImageProps {
  src: string;
  /** 800 px variant: bo'lsa — srcset (telefon kichigini yuklaydi). */
  smallSrc?: string | null;
  alt: string;
  width?: number | null;
  height?: number | null;
  /** "test" — test sahifasi (ustuvor yuklash); "card" — ro'yxatdagi karta (kichikroq, lazy). */
  variant?: "test" | "card";
}

// O'lcham noma'lum bo'lsa (eski backend) — eng ko'p uchraydigan nisbat.
const FALLBACK_WIDTH = 900;
const FALLBACK_HEIGHT = 506;

/** Kattalashgan rasm: ekranning 94% eni yoki 88% bo'yi (nisbat saqlanadi). */
function zoomedWidth(ratio: number): number {
  return Math.min(window.innerWidth * 0.94, window.innerHeight * 0.88 * ratio);
}

/**
 * Savol rasmi: o'lchamlar oldindan ma'lum bo'lgani uchun joy ajratiladi (layout
 * shift yo'q), yuklanguncha shimmer.
 *
 * Kattalashtirish: bir marta bosish (yoki Enter/Space) — rasm o'z joyidan ekran
 * o'rtasiga kattalashib chiqadi; yana bosish, rasmdan tashqarini bosish yoki
 * Esc — asl joyiga qaytadi. Yangi fayl yuklanmaydi: brauzer allaqachon
 * ko'rsatgan fayl (`currentSrc`) ishlatiladi, harakat faqat CSS transform.
 * Kunlik testlar, imtihon va Random — hammasi shu komponentdan foydalanadi.
 *
 * Ekranga moslashish: rasm balandligi `--img-max-h` dan oshmaydi. Ramka rasm
 * nisbatiga qarab torayadi — rasm doim ramkani to'liq to'ldiradi.
 */
export function QuestionImage({ src, smallSrc, alt, width, height, variant = "test" }: QuestionImageProps) {
  const { t } = useLocale();
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState<{ src: string; from: DOMRect } | null>(null);
  // Asl joy kattalashgan rasm qaytib kelguncha bo'sh turadi.
  const [hidden, setHidden] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const w = width ?? FALLBACK_WIDTH;
  const h = height ?? FALLBACK_HEIGHT;

  const open = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    // Ekrandagi fayl (srcset tanlagani) — qayta yuklanmaydi, sifati bir xil.
    setZoom({ src: imgRef.current?.currentSrc || src, from: trigger.getBoundingClientRect() });
    setHidden(true);
  }, [src]);

  const close = useCallback(() => {
    setZoom(null);
    // Fokus kattalashtirish tugmasiga qaytadi (klaviatura bilan davom etish uchun).
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, []);

  const setImg = useCallback((el: HTMLImageElement | null) => {
    imgRef.current = el;
    // Keshdan darhol yuklangan rasmda onLoad kelmasligi mumkin.
    if (el?.complete && el.naturalWidth) setLoaded(true);
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        aria-label={t.testSession.zoomImage}
        aria-haspopup="dialog"
        aria-expanded={zoom !== null}
        data-testid="question-image"
        style={{ maxWidth: `calc(var(--img-max-h) * ${w / h})` }}
        className={cn(
          "group relative mx-auto block w-full cursor-zoom-in overflow-hidden rounded-md bg-surface-2 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          variant === "test"
            ? "[--img-max-h:42dvh] twocol:[--img-max-h:clamp(14rem,calc(100dvh-14rem),600px)]"
            : "[--img-max-h:min(40dvh,22rem)]",
          // Kattalashgan paytda asl joyi bo'sh turadi — rasm "o'sha joydan chiqqandek".
          hidden && "opacity-0",
        )}
      >
        {!loaded && <span className="skeleton-shimmer absolute inset-0" aria-hidden="true" />}
        {smallSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={setImg}
            src={src}
            srcSet={`${smallSrc} 800w, ${src} 1600w`}
            sizes="(min-width: 1024px) 50vw, 100vw"
            alt={alt}
            width={w}
            height={h}
            loading={variant === "test" ? "eager" : "lazy"}
            fetchPriority={variant === "test" ? "high" : "auto"}
            onLoad={() => setLoaded(true)}
            className={cn("block h-auto w-full transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
          />
        ) : (
          <Image
            ref={setImg}
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
        )}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-full bg-background/75 text-foreground backdrop-blur transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-visible:opacity-100"
        >
          <Maximize2Icon className="size-4" />
        </span>
      </button>

      <ImageZoom zoom={zoom} onClose={close} onExited={() => setHidden(false)} alt={alt} ratio={w / h} width={w} height={h} />
    </>
  );
}

interface ImageZoomProps {
  zoom: { src: string; from: DOMRect } | null;
  onClose: () => void;
  /** Yopilish animatsiyasi tugadi. */
  onExited: () => void;
  alt: string;
  ratio: number;
  width: number;
  height: number;
}

function ImageZoom({ zoom, onClose, onExited, alt, ratio, width, height }: ImageZoomProps) {
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Kattalashgan eni (px) — oyna o'lchami o'zgarsa qayta hisoblanadi.
  const [target, setTarget] = useState(0);

  useLayoutEffect(() => {
    if (!zoom) return;
    const update = () => setTarget(zoomedWidth(ratio));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [zoom, ratio]);

  const isOpen = zoom !== null && target > 0;

  useEffect(() => {
    if (!isOpen) return;
    // Sahifa orqada skroll bo'lmasin (skrollbar yo'qolganda kontent siljimasin).
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    imageButtonRef.current?.focus({ preventScroll: true });
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }
    // capture — test sahifasining klaviatura ishlovchisidan (←/→, 1–4, Esc) oldin.
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [isOpen, onClose]);

  // Fokus oyna ichida qoladi (rasm ↔ yopish tugmasi).
  function trapFocus(event: ReactKeyboardEvent) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const next = document.activeElement === imageButtonRef.current ? closeButtonRef.current : imageButtonRef.current;
    next?.focus();
  }

  // Asl joydan ekran o'rtasiga: faqat transform (siljish + masshtab).
  let from: { x: number; y: number; scale: number; opacity?: number } = { x: 0, y: 0, scale: 1, opacity: 0 };
  if (zoom && target > 0 && !reduceMotion) {
    const r = zoom.from;
    from = { x: r.left + r.width / 2 - window.innerWidth / 2, y: r.top + r.height / 2 - window.innerHeight / 2, scale: r.width / target };
  }

  return (
    <AnimatePresence onExitComplete={onExited}>
      {isOpen && (
        <motion.div
          key="zoom"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          data-testid="image-zoom"
          className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-background/85 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          // Rasmdan tashqarini bosish — yopiladi.
          onClick={onClose}
          onKeyDown={trapFocus}
        >
          <motion.button
            ref={imageButtonRef}
            type="button"
            aria-label={t.testSession.shrinkImage}
            data-testid="image-zoomed"
            // Yana bosish (yoki Enter/Space) — asl holatiga qaytadi.
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="block cursor-zoom-out touch-pinch-zoom rounded-md shadow-card outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{ width: target }}
            initial={from}
            animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            exit={from}
            transition={{ duration: reduceMotion ? 0.12 : 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {/* Asl joydagi fayl — yangi so'rov yo'q. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom.src} alt={alt} width={width} height={height} draggable={false} className="block h-auto w-full rounded-md" />
          </motion.button>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
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
