import { redirect } from "next/navigation";

// Mavjud bo'lmagan admin manzili (masalan eski yoki xato havola) — 404 o'rniga
// panelning bosh sahifasiga. Proxy bu yerga faqat kirgan admin'ni o'tkazadi.
export default function AdminUnknownPage() {
  redirect("/admin/dashboard");
}
