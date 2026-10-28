import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminSecret, openAdminCookie } from "@/lib/admin/session-cookie";

// /admin — barcha sahifalar imzoli admin cookie'sini talab qiladi (kirish
// sahifasidan tashqari). API so'rovlarini /admin/api route'ining o'zi tekshiradi.
// Har bir javob qidiruv tizimlari uchun yopiq.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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
  matcher: ["/admin", "/admin/:path*"],
};
