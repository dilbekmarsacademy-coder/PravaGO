// Admin manzilini kanonik ko'rinishga keltiradi. Route'lar katta-kichik harfga
// sezgir, proxy matcher esa yo'q — shu sabab `/Admin`, `/admin/Dashboard` yoki
// messenjerdan oxiriga nuqta/qavs qo'shilib kelgan havola 404 berardi.
// Faqat statik qismlar (`admin` va bo'lim nomi) kichik harfga o'tkaziladi —
// ID va slug'lar o'zgarmaydi. Kanonik bo'lsa yoki admin manzili bo'lmasa — null.

const TRAILING_JUNK = /(?:[.,;:!?)\]}'"»”’\s]|%20|%22|%27|%29|%5D|%7D|%C2%BB|%E2%80%9D|%E2%80%99)+$/i;

export function canonicalAdminPath(pathname: string): string | null {
  let path = pathname.replace(TRAILING_JUNK, "");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  const segments = path.split("/");
  if (segments[1]?.toLowerCase() !== "admin") return null;
  segments[1] = "admin";
  if (segments[2]) segments[2] = segments[2].toLowerCase();
  const canonical = segments.join("/");
  return canonical === pathname ? null : canonical;
}
