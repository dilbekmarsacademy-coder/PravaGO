// Kurs mavzulari bo'yicha testdagi (to'g'ri javobi belgilangan) savollar soni.
// Javobi hali belgilanmagan savollar o'quvchiga ko'rsatilmaydi — shu sababli
// curriculum.ts dagi `questionCount` emas, server bergan son ishlatiladi.

import { authFetch } from "./session";

let cached: Promise<Record<string, number>> | null = null;

/** Sahifa davomida bir marta so'raladi; xato bo'lsa keyingi chaqiruvda qayta urinadi. */
export function getReadyCounts(): Promise<Record<string, number>> {
  cached ??= authFetch<Record<string, number>>("/topics/ready-counts").catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}
