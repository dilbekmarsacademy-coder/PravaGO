"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { flush, sessionId, track } from "@/lib/analytics";

/** Sahifa ochilishi, sessiya boshlanishi va davomiyligi (ko'rinib turgan paytda har daqiqada "ping"). */
export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    if (sessionId().isNew) track("session_start");
    track("page_view", { path: pathname });
  }, [pathname]);

  useEffect(() => {
    const ping = setInterval(() => {
      if (document.visibilityState === "visible" && !window.location.pathname.startsWith("/admin")) {
        sessionId();
        track("ping");
      }
    }, 60_000);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      clearInterval(ping);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  return null;
}
