/** Mavzu testi "o'tilgan" — frontend'dagi PASS_PERCENT (src/config/rules.ts) bilan bir xil. */
export const PASS_PERCENT = 98;

/** Kurs mavzusi slug'i: "day6-topic3" → { day: 6, order: 3 }. */
export function parseCourseSlug(slug: string): { day: number; order: number } | null {
  const m = /^day(\d+)-topic(\d+)$/.exec(slug);
  return m ? { day: Number(m[1]), order: Number(m[2]) } : null;
}
