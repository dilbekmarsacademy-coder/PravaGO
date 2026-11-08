import Image from "next/image";
import { cn } from "@/lib/utils";

// Brend logotipi. Ikkala variant ham render qilinadi, ko'rinadigani CSS bilan
// (html.dark) tanlanadi — hydration farqi va mavzu almashganda miltillash yo'q.
// Manba: public/logo/ (scratch skript bilan asl 3200 px fayllardan tayyorlangan).

const FULL = { light: "/logo/logo-light-160.webp", dark: "/logo/logo-dark-160.webp", width: 543, height: 160 };
const EMBLEM = { light: "/logo/emblem.png", dark: "/logo/emblem-dark.png", width: 512, height: 512 };

interface LogoProps {
  /** "full" — emblema + "PRAVA ISHONCH"; "emblem" — faqat qalqon (kvadrat). */
  variant?: "full" | "emblem";
  /** Balandlik shu klass bilan beriladi (masalan "h-8 sm:h-10"); kenglik avtomatik. */
  className?: string;
  /** Birinchi ekrandagi header — oldindan yuklanadi. */
  priority?: boolean;
}

export function Logo({ variant = "full", className, priority = false }: LogoProps) {
  const src = variant === "full" ? FULL : EMBLEM;
  const common = { width: src.width, height: src.height, priority, sizes: variant === "full" ? "180px" : "48px" };
  return (
    <>
      <Image {...common} alt="PravaIshonch" src={src.light} className={cn("w-auto select-none dark:hidden", className)} />
      <Image {...common} alt="PravaIshonch" src={src.dark} className={cn("hidden w-auto select-none dark:block", className)} />
    </>
  );
}
