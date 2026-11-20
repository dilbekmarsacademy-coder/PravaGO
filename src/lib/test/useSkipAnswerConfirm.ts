"use client";

import { useEffect, useState } from "react";
import { getMe } from "@/lib/api/account";

/**
 * GET /me → skipAnswerConfirm. Yuklanguncha va xatoda `null` — panel chiqaveradi
 * (`needsAnswerConfirm(null) === true`).
 */
export function useSkipAnswerConfirm(): boolean | null {
  const [skip, setSkip] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((me) => {
        if (!cancelled) setSkip(me.skipAnswerConfirm === true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return skip;
}
