"use client";

import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";
import { useReveal } from "./useReveal";

export default function Testimonials() {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const { t } = useLocale();

  return (
    <section id="fikrlar" className="scroll-mt-20 px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="font-mono text-xs tracking-[0.24em] text-neon-cyan uppercase">
            {t.testimonials.eyebrow}
          </span>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t.testimonials.heading}
          </h2>
        </div>

        <div
          ref={ref}
          className={cn(
            "reveal mt-12 grid gap-5 sm:grid-cols-3",
            visible && "reveal-visible",
          )}
        >
          {t.testimonials.reviews.map((review) => (
            <div
              key={review.name}
              className="glass flex flex-col gap-4 rounded-2xl p-6 transition-all duration-300 hover:border-neon-cyan/40"
            >
              <div className="flex gap-0.5 text-neon-amber">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon key={i} className="size-3.5 fill-current" />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">
                &ldquo;{review.text}&rdquo;
              </p>
              <div className="mt-auto pt-2">
                <p className="font-display text-sm font-bold text-foreground">
                  {review.name}
                </p>
                <p className="text-xs text-muted-foreground">{review.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
