"use client";

// Markaz o'quvchisi uchun: sessiya hali amaldami (boshqa qurilmadan kirilmadimi)
// — sahifa ko'rinib turganda har 45 s va sahifa qayta ko'ringanda/fokus olganda.
// Tab yashirin bo'lsa so'rov yuborilmaydi. Bekor qilingan sessiyani authFetch
// o'zi tozalaydi va bosh sahifaga qaytaradi.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { checkSession } from "@/lib/api/center";
import { isCenterSession } from "@/lib/api/session";

const INTERVAL_MS = 45_000;
/** Fokus/visibility hodisalari ketma-ket kelganda — ortiqcha so'rov yubormaslik uchun. */
const MIN_GAP_MS = 5_000;

export default function CenterSessionWatcher() {
  const pathname = usePathname();
  const enabled = !pathname.startsWith("/admin");

  useEffect(() => {
    if (!enabled) return;
    let last = 0;
    let inFlight = false;

    function check() {
      if (document.visibilityState !== "visible" || inFlight || !isCenterSession()) return;
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      inFlight = true;
      checkSession()
        .catch(() => undefined)
        .finally(() => {
          inFlight = false;
        });
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    const id = window.setInterval(check, INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    check();
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [enabled]);

  return null;
}
