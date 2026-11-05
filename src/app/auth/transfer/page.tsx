import type { Metadata } from "next";
import { TransferView } from "@/components/transfer/TransferView";

// Yangi manzil: eski domendan bir martalik kod bilan kelgan foydalanuvchi
// qayta kirmasdan sessiya oladi. Kod URL'dan darhol o'chiriladi.
export const metadata: Metadata = {
  title: { absolute: "Kirilmoqda — PravaIshonch" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default function TransferPage() {
  return <TransferView />;
}
