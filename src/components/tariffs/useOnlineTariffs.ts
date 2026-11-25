"use client";

import { useEffect, useState } from "react";
import { getOnlineTariffs, type OnlineTariffs } from "@/lib/api/orders";

/** Serverdagi tariflar (narx, muddat) va onlayn to'lov yoqilganmi; null — hali noma'lum yoki aloqa yo'q. */
export function useOnlineTariffs(): OnlineTariffs | null {
  const [data, setData] = useState<OnlineTariffs | null>(null);
  useEffect(() => {
    getOnlineTariffs().then(setData).catch(() => undefined);
  }, []);
  return data;
}
