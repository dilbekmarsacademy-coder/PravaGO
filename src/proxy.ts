import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminSecret, openAdminCookie } from "@/lib/admin/session-cookie";
import { canonicalAdminPath } from "@/lib/admin/path";
import { MOVED_PATH, OLD_HOST } from "@/lib/transfer";

/** Ko'chish sahifasi (server qismi) eski yo'lni shu sarlavhadan oladi — JS'siz meta refresh uchun. */
export const MOVED_FROM_HEADER = "x-moved-from";

// /admin — barcha sahifalar imzoli admin cookie'sini talab qiladi (kirish
// sahifasidan tashqari). API so'rovlarini /admin/api route'ining o'zi tekshiradi.
// Har bir javob qidiruv tizimlari uchun yopiq.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Eski manzil (aynan pravatayyor.vercel.app): har qanday sahifa — "Sayt
  // ko'chdi" sahifasi; brauzerdagi URL (yo'l va query) o'zgarmaydi.
  if (request.headers.get("host") === OLD_HOST) {
    if (pathname === MOVED_PATH) return NextResponse.next();
    const headers = new Headers(request.headers);
    headers.set(MOVED_FROM_HEADER, `${pathname}${search}`.slice(0, 2000));
    const response = NextResponse.rewrite(new URL(MOVED_PATH, request.url), { request: { headers } });
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  // `/Admin`, `/admin/Login`, `/admin.` kabi havolalar — kanonik manzilga.
  const canonical = canonicalAdminPath(pathname);
  if (canonical) {
    const url = request.nextUrl.clone();
    url.pathname = canonical;
    return NextResponse.redirect(url);
  }
  // Prefiks matcher `/administrator` kabi boshqa manzillarni ham ushlaydi.
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return NextResponse.next();

  const secret = adminSecret();
  const token = secret ? openAdminCookie(secret, request.cookies.get(ADMIN_COOKIE)?.value) : null;

  let response: NextResponse;
  if (pathname.startsWith("/admin/api/")) {
    response = NextResponse.next();
  } else if (pathname === "/admin/login") {
    response = token ? NextResponse.redirect(new URL("/admin/dashboard", request.url)) : NextResponse.next();
  } else if (!token) {
    const url = new URL("/admin/login", request.url);
    if (pathname !== "/admin") url.searchParams.set("next", `${pathname}${search}`);
    response = NextResponse.redirect(url);
  } else {
    response = NextResponse.next();
  }
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  // Barcha sahifalar (eski manzilni ko'chirish uchun) — Next ichki fayllari,
  // /admin/api, /api va statik fayllar (nuqtali yo'llar: robots.txt, rasmlar) bundan tashqari.
  // `/Admin`, `/admin.` kabi variantlar ham shu matcher'ga tushadi.
  matcher: ["/((?!_next/|api/|admin/api/|[^/]*\\.[a-z0-9]+$).*)", "/:rest([aA][dD][mM][iI][nN].*)"],
};
