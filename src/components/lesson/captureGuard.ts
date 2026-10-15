"use client";

// Skrinshot va ekran yozishga qarshi to'siq.
//
// MUHIM: veb-sahifa OS darajasidagi skrinshot va ekran yozishni 100% to'sa
// OLMAYDI (telefon tugmalari, tashqi kamera, OS yozuvchi dasturlari brauzerga
// bildirilmaydi). Bu yerdagi hammasi "best-effort" — urinishni qiyinlashtiradi
// va sizib chiqqan suratni egasiga bog'laydi (pleyerdagi suzuvchi suv belgisi):
//  - PrintScreen, Cmd+Shift (macOS: 3/4/5) va Win+Shift (Windows: S) bosilganda —
//    video tugma kombinatsiyasi tugashidan oldin qora qalqon bilan yopiladi va
//    clipboard tozalashga urinib ko'riladi;
//  - oyna fokusni yo'qotganda (Snipping Tool, ekran yozuvchi dastur, boshqa oyna)
//    va sahifa yashirilganda — pauza + qalqon; qaytganda "Davom etish" tugmasi;
//  - chop etish (Ctrl/Cmd+P) bloklanadi, print rejimida pleyer joyi bo'sh chiqadi;
//  - DevTools ochilishi oyna o'lchamlari farqi bo'yicha taxmin qilinadi — faqat
//    pauza va ogohlantirish, foydalanuvchi bloklanmaydi (heuristika xato qilishi mumkin).

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type ShieldReason = "capture" | "away";

/** Shu farqdan katta bo'lsa DevTools yonda/pastda ochiq deb taxmin qilinadi. */
const DEVTOOLS_GAP_PX = 170;
const DEVTOOLS_CHECK_MS = 1000;

function isCaptureCombo(event: KeyboardEvent): boolean {
  if (event.key === "PrintScreen" || event.code === "PrintScreen") return true;
  // Cmd+Shift (macOS) yoki Win+Shift (Windows) — keyingi tugma (3/4/5/S) kutilmasdan.
  if (event.metaKey && event.shiftKey) return true;
  // Win+Shift: ba'zi brauzerlarda Meta alohida keladi.
  if ((event.key === "Meta" || event.key === "OS") && event.shiftKey) return true;
  if (event.key === "Shift" && event.metaKey) return true;
  return false;
}

function isPrintCombo(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && event.code === "KeyP";
}

function clearClipboard() {
  // Windows PrintScreen rasmni buferga yozadi — ustidan bo'sh matn yozamiz.
  // Ruxsat bo'lmasa (fokus yo'q va h.k.) jim o'tadi.
  void navigator.clipboard?.writeText("").catch(() => undefined);
}

function devtoolsLikelyOpen(): boolean {
  // Mobil brauzerlarda oyna o'lchamlari boshqacha ishlaydi — u yerda tekshirmaymiz.
  if (!window.matchMedia("(pointer: fine)").matches) return false;
  const widthGap = window.outerWidth - window.innerWidth;
  const heightGap = window.outerHeight - window.innerHeight;
  return widthGap > DEVTOOLS_GAP_PX || heightGap > DEVTOOLS_GAP_PX + 120; // yuqori panel/tablar ~120px
}

export interface CaptureGuard {
  /** Qalqon tushgan sabab (null — qalqon yo'q). */
  reason: ShieldReason | null;
  /** Sahifa yana ko'rinib, fokusda — "Davom etish" bosish mumkin. */
  canResume: boolean;
  /** Qalqonni olib tashlaydi (faqat `canResume` bo'lsa). */
  resume: () => void;
}

/**
 * `onShield` — qalqon tushgan zahoti (videoni pauza qilish). `onDevtools` —
 * DevTools ochilgandek ko'ringanda (faqat yopiq → ochiq o'tishida bir marta).
 * Konteyner ichidagi iframe'ga fokus o'tishi ("yana bosing" rejimi) fokus yo'qotish hisoblanmaydi.
 */
export function useCaptureGuard(
  containerRef: RefObject<HTMLElement | null>,
  onShield: () => void,
  onDevtools: () => void,
): CaptureGuard {
  const [reason, setReason] = useState<ShieldReason | null>(null);
  const [present, setPresent] = useState(true);
  const callbacksRef = useRef({ onShield, onDevtools });

  useEffect(() => {
    callbacksRef.current = { onShield, onDevtools };
  }, [onShield, onDevtools]);

  useEffect(() => {
    const raise = (next: ShieldReason) => {
      setReason((current) => (current === "capture" ? current : next));
      callbacksRef.current.onShield();
    };
    const refreshPresence = () => setPresent(document.visibilityState === "visible" && document.hasFocus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (isPrintCombo(event)) {
        event.preventDefault();
        raise("capture");
        return;
      }
      if (isCaptureCombo(event)) {
        raise("capture");
        clearClipboard();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "PrintScreen" || event.code === "PrintScreen") {
        raise("capture");
        clearClipboard();
      }
    };
    const onBlur = () => {
      // Fokus o'zimizning iframe'ga o'tgan bo'lsa — bu tashqi oyna emas.
      window.setTimeout(() => {
        const active = document.activeElement;
        if (active instanceof HTMLIFrameElement && containerRef.current?.contains(active)) return;
        setPresent(false);
        raise("away");
      }, 0);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") raise("away");
      refreshPresence();
    };
    const onBeforePrint = () => raise("capture");

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", refreshPresence);
    window.addEventListener("beforeprint", onBeforePrint);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", refreshPresence);
      window.removeEventListener("beforeprint", onBeforePrint);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [containerRef]);

  // DevTools: yengil heuristika, faqat o'tish paytida xabar beradi.
  useEffect(() => {
    let open = devtoolsLikelyOpen();
    const timer = window.setInterval(() => {
      const now = devtoolsLikelyOpen();
      if (now && !open) callbacksRef.current.onDevtools();
      open = now;
    }, DEVTOOLS_CHECK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const resume = useCallback(() => {
    if (document.visibilityState === "visible" && document.hasFocus()) setReason(null);
  }, []);

  return { reason, canResume: present, resume };
}
