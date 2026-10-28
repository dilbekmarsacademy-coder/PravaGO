// Admin API proxy: brauzer → shu route → backend /admin/*.
// - sessiya tokeni faqat httpOnly cookie'da (brauzer JS uni ko'rmaydi);
// - CSRF: Origin tekshiruvi + double-submit token (o'zgartiruvchi so'rovlarda);
// - backend'ga proxy kaliti va mijoz IP'si qo'shiladi.

import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_CSRF_COOKIE,
  ADMIN_CSRF_HEADER,
  ADMIN_SESSION_TTL_SEC,
  adminProxyKey,
  adminSecret,
  openAdminCookie,
  safeEqual,
  sealAdminCookie,
} from "@/lib/admin/session-cookie";

export const dynamic = "force-dynamic";
// Rasmga ishlov berish (fon kesish) uzoq davom etishi mumkin.
export const maxDuration = 300;

const API_BASE_URL = (process.env.ADMIN_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
const SAFE_METHODS = new Set(["GET", "HEAD"]);
const PASS_RESPONSE_HEADERS = ["content-type", "content-disposition", "cache-control", "retry-after"];

const cookieBase = { httpOnly: true, secure: true, sameSite: "strict" as const, path: "/" };

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function clientIp(req: NextRequest): string {
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/** So'rov shu saytning o'zidan kelgan (boshqa saytdagi forma/skript emas). */
function isSameOrigin(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function clearCookies(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE, "", { ...cookieBase, maxAge: 0 });
  res.cookies.set(ADMIN_CSRF_COOKIE, "", { ...cookieBase, httpOnly: false, maxAge: 0 });
}

async function forward(req: NextRequest, path: string, secret: string, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    "x-admin-proxy-key": adminProxyKey(secret),
    "x-admin-client-ip": clientIp(req),
    "user-agent": req.headers.get("user-agent")?.slice(0, 300) ?? "",
  };
  if (token) headers["x-admin-session"] = token;
  const contentType = req.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;
  const hasBody = !SAFE_METHODS.has(req.method);
  return fetch(`${API_BASE_URL}/admin/${path}${req.nextUrl.search}`, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    cache: "no-store",
    redirect: "manual",
  });
}

function relay(upstream: Response): NextResponse {
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of PASS_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new NextResponse(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers });
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const secret = adminSecret();
  if (!secret || !API_BASE_URL) return json(503, { code: "ADMIN_NOT_CONFIGURED", message: "Admin panel sozlanmagan" });
  const path = (await ctx.params).path.map(encodeURIComponent).join("/");
  const mutating = !SAFE_METHODS.has(req.method);
  if (mutating && !isSameOrigin(req)) return json(403, { code: "ADMIN_CSRF", message: "So'rov manbasi noto'g'ri" });

  if (path === "auth/login") {
    if (req.method !== "POST") return json(405, { message: "Method not allowed" });
    const upstream = await forward(req, path, secret, null);
    if (!upstream.ok) return relay(upstream);
    const data = (await upstream.json()) as { token: string; expiresAt: string; admin: unknown };
    const expiresAt = Math.min(new Date(data.expiresAt).getTime(), Date.now() + ADMIN_SESSION_TTL_SEC * 1000);
    const res = json(200, { admin: data.admin, expiresAt: new Date(expiresAt).toISOString() });
    const maxAge = Math.floor((expiresAt - Date.now()) / 1000);
    res.cookies.set(ADMIN_COOKIE, sealAdminCookie(secret, data.token, expiresAt), { ...cookieBase, maxAge });
    res.cookies.set(ADMIN_CSRF_COOKIE, randomBytes(24).toString("base64url"), { ...cookieBase, httpOnly: false, maxAge });
    return res;
  }

  const token = openAdminCookie(secret, req.cookies.get(ADMIN_COOKIE)?.value);
  if (!token) {
    const res = json(401, { code: "ADMIN_SESSION_REQUIRED", message: "Qaytadan kiring" });
    clearCookies(res);
    return res;
  }
  if (mutating) {
    const expected = req.cookies.get(ADMIN_CSRF_COOKIE)?.value;
    const given = req.headers.get(ADMIN_CSRF_HEADER);
    if (!expected || !given || !safeEqual(expected, given)) {
      return json(403, { code: "ADMIN_CSRF", message: "CSRF tekshiruvi o'tmadi — sahifani yangilang" });
    }
  }

  const upstream = await forward(req, path, secret, token);
  const res = relay(upstream);
  if (path === "auth/logout" || upstream.status === 401) clearCookies(res);
  return res;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
