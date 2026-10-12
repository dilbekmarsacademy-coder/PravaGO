"use client";

// Skrinshot va ekran yozishga qarshi to'siq. Brauzer OS darajasidagi suratga
// olishni to'liq taqiqlay olmaydi — shuning uchun video suratga tushishi
// mumkin bo'lgan har bir lahzada qora "qalqon" bilan yopiladi:
//  - PrintScreen, Cmd+Shift (macOS: 3/4/5) va Win+Shift (Windows: S) bosilganda —
//    qalqon tugma kombinatsiyasi tugashidan oldin tushadi;
//  - oyna fokusni yo'qotganda (Snipping Tool, ekran yozuvchi dasturlar, boshqa oyna)
//    va sahifa yashirilganda;
//  - chop etish (Ctrl/Cmd+P) bloklanadi, print rejimida pleyer umuman chiqmaydi.

import { useEffect, useRef, useState, type RefObject } from "react";

/** Tugmalar qo'yib yuborilgandan keyin qalqon shuncha vaqt turadi. */
const RELEASE_MS = 800;

function isCaptureCombo(event: KeyboardEvent): boolean {
  if (event.key === "PrintScreen" || event.code === "PrintScreen") return true;
  // Cmd+Shift (macOS) yoki Win+Shift (Windows) — keyingi tugma kutilmasdan.
  if (event.metaKey && event.shiftKey) return true;
  // Win+Shift: ba'zi brauzerlarda Meta alohida keladi.
  if ((event.key === "Meta" || event.key === "OS") && event.shiftKey) return true;
  if (event.key === "Shift" && event.metaKey) return true;
  return false;
}

function isPrintCombo(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && event.code === "KeyP";
}

/**
 * Qalqon holatini qaytaradi. `onShield` — qalqon tushgan zahoti (masalan, videoni pauza qilish).
 * Konteyner ichidagi iframe'ga fokus o'tishi ("yana bosing" rejimi) fokus yo'qotish hisoblanmaydi.
 */
export function useCaptureGuard(containerRef: RefObject<HTMLElement | null>, onShield: () => void): boolean {
  const [shielded, setShielded] = useState(false);
  const onShieldRef = useRef(onShield);
  const releaseTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    onShieldRef.current = onShield;
  }, [onShield]);

  useEffect(() => {
    const raise = () => {
      window.clearTimeout(releaseTimerRef.current);
      setShielded(true);
      onShieldRef.current();
    };
    const release = () => {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = window.setTimeout(() => {
        if (document.visibilityState === "visible" && document.hasFocus()) setShielded(false);
      }, RELEASE_MS);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isPrintCombo(event)) {
        event.preventDefault();
        raise();
        return;
      }
      if (isCaptureCombo(event)) raise();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "PrintScreen" || event.code === "PrintScreen") {
        raise();
        // Windows PrintScreen rasmni buferga yozadi — ustidan yozib yuboramiz.
        void navigator.clipboard?.writeText("").catch(() => undefined);
      }
      if (!event.metaKey && !event.shiftKey) release();
    };
    const onBlur = () => {
      // Fokus o'zimizning iframe'ga o'tgan bo'lsa — bu tashqi oyna emas.
      window.setTimeout(() => {
        const active = document.activeElement;
        if (active instanceof HTMLIFrameElement && containerRef.current?.contains(active)) return;
        raise();
      }, 0);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") raise();
      else release();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", release);
    window.addEventListener("beforeprint", raise);
    window.addEventListener("afterprint", release);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(releaseTimerRef.current);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", release);
      window.removeEventListener("beforeprint", raise);
      window.removeEventListener("afterprint", release);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [containerRef]);

  return shielded;
}
