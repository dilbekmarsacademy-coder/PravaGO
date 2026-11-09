import { cn } from "@/lib/utils";
import { PAYMENTS_ENABLED } from "@/config/features";

// To'lov tizimlari logolari — faqat NEXT_PUBLIC_PAYMENTS_ENABLED=true bo'lsa.
// TODO(logolar): fayllar public/payments/ ga qo'yiladi (payme.svg, click.svg,
// uzum.svg, uzcard.svg, humo.svg); format boshqa bo'lsa — `src` ni yangilang.
const PROVIDERS = [
  { name: "Payme", src: "/payments/payme.svg" },
  { name: "Click", src: "/payments/click.svg" },
  { name: "Uzum Bank", src: "/payments/uzum.svg" },
  { name: "Uzcard", src: "/payments/uzcard.svg" },
  { name: "Humo", src: "/payments/humo.svg" },
];

export default function PaymentLogos({ className }: { className?: string }) {
  if (!PAYMENTS_ENABLED) return null;
  return (
    <ul className={cn("flex flex-wrap items-center gap-3", className)} aria-label="Qabul qilinadigan to'lov usullari" data-testid="payment-logos">
      {PROVIDERS.map((p) => (
        <li key={p.name} className="flex h-9 items-center rounded-lg border border-border bg-white px-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.src} alt={p.name} className="h-5 w-auto" loading="lazy" />
        </li>
      ))}
    </ul>
  );
}
