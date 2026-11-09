import Link from "next/link";
import { LockIcon, ShoppingCartIcon } from "lucide-react";
import { PAYMENTS_ENABLED } from "@/config/features";
import type { TariffId } from "@/config/tariffs";
import { cn } from "@/lib/utils";

/**
 * "Sotib olish": onlayn to'lov ulanguncha (NEXT_PUBLIC_PAYMENTS_ENABLED=false)
 * o'chirilgan. Yonida doim qaytarish siyosatiga havola.
 */
export default function BuyButton({ tariff, durationDays, highlighted }: { tariff: TariffId; durationDays: number | null; highlighted?: boolean }) {
  const base = "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-bold";
  return (
    <div className="flex flex-col gap-2">
      {PAYMENTS_ENABLED ? (
        // TODO(to'lov): Payme/Click to'lov sahifasini ochish (tarif va muddat — data-* atributlarda). Hozircha hech qayerga olib bormaydi.
        <button
          type="button"
          data-tariff={tariff}
          data-duration={durationDays ?? "until_passed"}
          className={cn(base, highlighted ? "bg-gradient-to-r from-neon-orange to-neon-orange-2 text-background" : "border border-border text-foreground hover:border-neon-cyan/50")}
        >
          <ShoppingCartIcon className="size-4" />
          Sotib olish
        </button>
      ) : (
        <>
          <button type="button" disabled className={cn(base, "cursor-not-allowed border border-border bg-foreground/5 text-muted-foreground")} data-testid="buy-disabled">
            <LockIcon className="size-4" />
            Sotib olish
          </button>
          <span className="text-center text-xs text-muted-foreground">Toʻlov tez orada ulanadi</span>
        </>
      )}
      <Link href="/qaytarish" className="text-center text-xs text-muted-foreground underline-offset-2 hover:text-neon-cyan hover:underline">
        Qaytarish siyosati
      </Link>
    </div>
  );
}
