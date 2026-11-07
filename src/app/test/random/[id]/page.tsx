"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MotionConfig } from "framer-motion";
import { ArrowLeftIcon, RotateCcwIcon } from "lucide-react";
import { getRandomTest, type RandomTestState } from "@/lib/api/random-tests";
import { useLocale } from "@/lib/i18n/useLocale";
import { AppHeader } from "@/components/shared/AppHeader";
import { Button, buttonClasses } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { RandomTestResult } from "@/components/random/RandomTestResult";
import { RandomTestSession } from "@/components/random/RandomTestSession";

/** Tasodifiy test: tugallanmagan bo'lsa — test (taymer serverdan davom etadi), aks holda — natija. */
export default function RandomTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLocale();
  const labels = t.kabinet.randomTest;
  const [state, setState] = useState<RandomTestState | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    getRandomTest(id)
      .then(setState)
      .catch(() => setError(true));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (state?.status === "in_progress") {
    return (
      <MotionConfig reducedMotion="user">
        <RandomTestSession key={state.id} initial={state} onFinished={setState} />
      </MotionConfig>
    );
  }

  return (
    <>
      <AppHeader>
        <Link href="/kabinet/random" aria-label={labels.title} className={buttonClasses({ variant: "secondary", size: "icon", className: "size-11 md:size-10" })}>
          <ArrowLeftIcon className="size-4.5" />
        </Link>
        <span className="truncate text-sm font-semibold text-foreground">{labels.title}</span>
      </AppHeader>
      {error ? (
        <main className="mx-auto w-full max-w-md px-5 py-10">
          <Card role="alert" className="flex flex-col items-center gap-4 p-8 text-center">
            <p className="text-sm text-foreground">{labels.loadError}</p>
            <Button variant="secondary" onClick={load}>
              <RotateCcwIcon className="size-4" />
              {labels.retry}
            </Button>
          </Card>
        </main>
      ) : !state ? (
        <main className="mx-auto w-full max-w-3xl px-5 py-8">
          <div className="skeleton-shimmer h-48 rounded-2xl" />
        </main>
      ) : (
        <RandomTestResult state={state} />
      )}
    </>
  );
}
