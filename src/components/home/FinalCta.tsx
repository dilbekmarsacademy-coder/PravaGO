"use client";

import { FlagIcon, RocketIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReveal } from "./useReveal";

interface FinalCtaProps {
  onStart: () => void;
}

const CHECKER_PATTERN = {
  backgroundImage:
    "repeating-conic-gradient(#f3f6fb 0% 25%, transparent 0% 50%)",
  backgroundSize: "16px 16px",
};

export default function FinalCta({ onStart }: FinalCtaProps) {
  const { ref, visible } = useReveal<HTMLDivElement>();

  return (
    <section className="px-5 py-20 sm:px-8">
      <div
        ref={ref}
        className={cn(
          "reveal glass relative mx-auto max-w-4xl overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-10",
          visible && "reveal-visible",
        )}
      >
        {/* Finish bayrog'i chizig'i */}
        <div className="absolute inset-x-0 top-0 h-2 opacity-70" style={CHECKER_PATTERN} aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 h-2 opacity-70" style={CHECKER_PATTERN} aria-hidden="true" />

        {/* Avtomobil chiroqlari nuri */}
        <div
          className="pointer-events-none absolute -top-10 left-1/4 h-40 w-40 -translate-x-1/2 rounded-full bg-neon-orange/25 blur-[80px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -top-10 right-1/4 h-40 w-40 translate-x-1/2 rounded-full bg-neon-cyan/20 blur-[80px]"
          aria-hidden="true"
        />

        <span className="glow-orange mx-auto flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 text-background">
          <FlagIcon className="size-6" />
        </span>

        <h2 className="mt-5 font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
          Bugundan boshlab, tizimli tayyorlaning
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
          63 ta bilet, 1 260 ta savol va 7 kunlik nazorat dasturi — hoziroq
          ro&rsquo;yxatdan o&rsquo;ting va tayyorgarlikni bugun boshlang.
        </p>
        <Button
          onClick={onStart}
          className="glow-orange-hover relative mx-auto mt-8 h-auto rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-7 py-3.5 text-base font-bold text-background"
        >
          Tayyorlanishni boshlash
          <RocketIcon className="size-4" />
        </Button>
      </div>
    </section>
  );
}
