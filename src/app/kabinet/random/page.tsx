"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ShuffleIcon } from "lucide-react";
import { useLocale } from "@/lib/i18n/useLocale";
import { Card } from "@/components/shared/Card";
import { buttonClasses } from "@/components/shared/Button";

interface RandomPageProps {
  searchParams: Promise<{ size?: string }>;
}

export default function RandomTestPage({ searchParams }: RandomPageProps) {
  const { size } = use(searchParams);
  const { t } = useLocale();
  const labels = t.kabinet.randomTest;
  const sizeNumber = Number(size);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-10 text-center sm:px-8">
      <Card className="flex max-w-md flex-col items-center gap-4 p-10">
        <span className="flex size-14 items-center justify-center rounded-full bg-foreground/5 text-info">
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
          className={buttonClasses({ variant: "secondary", size: "md", className: "mt-2" })}
        >
          <ArrowLeftIcon className="size-4" />
          {t.kabinet.backToKabinet}
        </Link>
      </Card>
    </main>
  );
}
