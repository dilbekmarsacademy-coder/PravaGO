"use client";

// Haftalik natijalar yangilanishi (dushanba 22:00, Asia/Tashkent):
// 1) dushanba 12:00 dan sariq ogohlantirish lentasi (faqat tizimga kirgan va
//    exempt bo'lmagan foydalanuvchiga — server hal qiladi);
// 2) yangilanish bo'lishi bilan ochiq turgan sahifa ham yangilanadi: holat har
//    45 s da va tab qayta ko'ringanda so'raladi, `lastResetAt` o'zgarsa — sahifa
//    qayta yuklanadi (barcha ma'lumot serverdan qaytadan olinadi) va "Natijalar
//    yangilandi" xabari chiqadi. Natijalar brauzerda keshlanmaydi (kabinet ularni
//    har ochilishda serverdan oladi), shuning uchun qayta yuklash yetarli. Faol test (/test/...) to'xtatilmaydi: yangilash
//    test sahifasidan chiqilganda bajariladi. Admin panelda ishlamaydi.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getResetStatus } from "@/lib/api/reset-status";
import { isCenterSession } from "@/lib/api/session";
import { getRegistration } from "@/lib/registration-store";
import { showToast } from "@/components/shared/Toast";

const INTERVAL_MS = 45_000;
const MIN_GAP_MS = 5_000;
/** Qayta yuklangandan keyin xabar ko'rsatish belgisi. */
const TOAST_KEY = "pt_reset_toast";
const BANNER_TEXT = "Bugun soat 22:00 da barcha test natijalari yangilanadi (nolga tushadi). Iltimos, shunga tayyorlaning.";

/** Faol test sahifalari (mavzu testi, random test, yakuniy imtihon) — yangilash kechiktiriladi. */
const isActiveTestRoute = (path: string) => path.startsWith("/test/");

function reloadWithToast(): void {
  try {
    sessionStorage.setItem(TOAST_KEY, "1");
  } catch {
    // ignore
  }
  window.location.reload();
}

export default function ResetWatcher() {
  const pathname = usePathname();
  const enabled = !pathname.startsWith("/admin");
  const [banner, setBanner] = useState(false);
  const known = useRef<string | null | undefined>(undefined);
  const pending = useRef(false);
  const pathRef = useRef(pathname);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pathRef.current = pathname;
    if (pending.current && !isActiveTestRoute(pathname)) reloadWithToast();
  }, [pathname]);

  // Qayta yuklangandan keyin.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(TOAST_KEY)) {
        sessionStorage.removeItem(TOAST_KEY);
        showToast({ tone: "success", message: "Natijalar yangilandi" });
      }
    } catch {
      // ignore
    }
  }, []);

  const onStatus = useCallback((lastResetAt: string | null) => {
    if (known.current === undefined) {
      // Birinchi javob: sahifa ma'lumotlari allaqachon shu holatdan keyin olingan.
      known.current = lastResetAt;
      return;
    }
    if (!lastResetAt || lastResetAt === known.current) return;
    known.current = lastResetAt;
    if (isActiveTestRoute(pathRef.current)) pending.current = true;
    else reloadWithToast();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let last = 0;
    let inFlight = false;
    async function check() {
      if (document.visibilityState !== "visible" || inFlight) return;
      if (!getRegistration() && !isCenterSession()) return;
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      inFlight = true;
      try {
        const status = await getResetStatus();
        if (!status) return;
        setBanner(status.bannerVisible);
        onStatus(status.lastResetAt);
      } catch {
        // Tarmoq xatosi — keyingi safar.
      } finally {
        inFlight = false;
      }
    }
    check();
    const id = setInterval(check, INTERVAL_MS);
    const onVisible = () => check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [enabled, onStatus]);

  // Lenta balandligi — sticky/fixed header'lar shu qadar pastga suriladi (--reset-banner-h).
  const visible = enabled && banner;
  useEffect(() => {
    const root = document.documentElement;
    const el = bannerRef.current;
    if (!visible || !el) {
      root.style.removeProperty("--reset-banner-h");
      return;
    }
    const update = () => root.style.setProperty("--reset-banner-h", `${el.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--reset-banner-h");
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <div
      ref={bannerRef}
      role="status"
      aria-live="polite"
      className="reset-banner sticky top-0 z-[60] w-full overflow-hidden border-b border-yellow-600/40 bg-yellow-300 text-yellow-950"
      data-testid="reset-banner"
    >
      <p className="sr-only">{BANNER_TEXT}</p>
      <div className="reset-banner-track flex w-max py-1.5 text-sm font-semibold whitespace-nowrap" aria-hidden="true">
        <span className="px-8">{BANNER_TEXT}</span>
        <span className="px-8">{BANNER_TEXT}</span>
      </div>
      <p className="reset-banner-static hidden px-4 py-1.5 text-center text-sm font-semibold" aria-hidden="true">
        {BANNER_TEXT}
      </p>
    </div>
  );
}
