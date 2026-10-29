import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminSecret, openAdminCookie } from "@/lib/admin/session-cookie";
import { canonicalAdminPath } from "@/lib/admin/path";

// /admin — barcha sahifalar imzoli admin cookie'sini talab qiladi (kirish
// sahifasidan tashqari). API so'rovlarini /admin/api route'ining o'zi tekshiradi.
// Har bir javob qidiruv tizimlari uchun yopiq.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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
  // `/Admin`, `/admin.` kabi variantlar ham ushlanishi uchun harfga sezgir
  // bo'lmagan prefiks.
  matcher: ["/:rest([aA][dD][mM][iI][nN].*)"],
};
