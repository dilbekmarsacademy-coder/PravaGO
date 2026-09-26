"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ShuffleIcon } from "lucide-react";
import { useLocale } from "@/lib/i18n/useLocale";

interface RandomPageProps {
  searchParams: Promise<{ size?: string }>;
}

export default function RandomTestPage({ searchParams }: RandomPageProps) {
  const { size } = use(searchParams);
  const { t } = useLocale();
  const labels = t.kabinet.randomTest;
  const sizeNumber = Number(size);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10 text-center sm:px-8">
      <div className="glass flex max-w-md flex-col items-center gap-4 rounded-2xl p-10">
        <span className="flex size-14 items-center justify-center rounded-full bg-foreground/5 text-neon-cyan">
          <ShuffleIcon className="size-6" />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">
            {Number.isInteger(sizeNumber) && sizeNumber > 0
              ? labels.pageTitle(sizeNumber)
              : labels.pageTitleNoSize}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{labels.soon}</p>
        </div>
        <Link
          href="/kabinet"
          className="mt-2 inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground/90 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
        >
          <ArrowLeftIcon className="size-4" />
          {t.kabinet.backToKabinet}
        </Link>
      </div>
    </main>
  );
}
