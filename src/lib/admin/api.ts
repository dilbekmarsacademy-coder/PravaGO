"use client";

// Admin panel uchun fetch: faqat shu saytning /admin/api proxy'si orqali.
// Sessiya httpOnly cookie'da; o'zgartiruvchi so'rovlarga CSRF token qo'shiladi.

const CSRF_COOKIE = "__Host-pt_admin_csrf";

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

function csrfToken(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE.replace(/[-.]/g, "\\$&")}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) return message.join("; ");
    if (typeof message === "string") return message;
  }
  return `So'rov bajarilmadi (${status})`;
}

export async function adminFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const method = (rest.method ?? (json !== undefined ? "POST" : "GET")).toUpperCase();
  const res = await fetch(`/admin/api/${path.replace(/^\//, "")}`, {
    ...rest,
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "x-csrf-token": csrfToken() } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 && !path.startsWith("auth/login")) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/admin/login?next=${next}`;
    throw new AdminApiError(401, "ADMIN_SESSION_REQUIRED", "Qaytadan kiring");
  }
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // JSON emas
    }
    const code = body && typeof body === "object" && "code" in body ? String((body as { code: unknown }).code) : undefined;
    throw new AdminApiError(res.status, code, errorMessage(body, res.status));
  }
  if (res.status === 204) return undefined as T;
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("application/json") ? await res.json() : await res.text()) as T;
}

/** Fayl yuklab olish (CSV va h.k.) — brauzer orqali. */
export function adminDownloadUrl(path: string): string {
  return `/admin/api/${path.replace(/^\//, "")}`;
}

export function adminAssetUrl(assetId: string): string {
  return `/admin/api/images/assets/${assetId}`;
}
