import type { Request } from "express";

/**
 * Mijoz IP'si. Vercel'da so'rov proksi orqali keladi va `x-forwarded-for`ni
 * platformaning o'zi yozadi (mijoz soxtalashtira olmaydi); lokal/e2e'da — ulanish IP'si.
 */
export function requestIp(req: Request): string {
  if (process.env.VERCEL) {
    const forwarded = req.headers["x-vercel-forwarded-for"] ?? req.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
    if (first) return first.slice(0, 100);
  }
  return String(req.ip ?? "unknown").slice(0, 100);
}
