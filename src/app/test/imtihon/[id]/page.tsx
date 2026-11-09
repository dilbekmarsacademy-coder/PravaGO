"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MotionConfig } from "framer-motion";
import { ArrowLeftIcon, RotateCcwIcon } from "lucide-react";
import { getFinalAttempt, type AttemptState } from "@/lib/api/final-exam";
import { ApiError } from "@/lib/api/session";
import { AppHeader } from "@/components/shared/AppHeader";
import { Button, buttonClasses } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { FinalExamResult } from "@/components/final-exam/FinalExamResult";
import { FinalExamSession } from "@/components/final-exam/FinalExamSession";

/** Yakuniy imtihon urinishi: faol bo'lsa — imtihon (taymer serverdan davom etadi), aks holda — natija. */
export default function FinalExamAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, setState] = useState<AttemptState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getFinalAttempt(id)
      .then(setState)
      .catch((err: unknown) =>
        setError(err instanceof ApiError && err.status === 404 ? "Urinish topilmadi." : "Ma'lumotni yuklab bo'lmadi. Internet aloqasini tekshiring."),
      );
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (state?.status === "IN_PROGRESS") {
    return (
      <MotionConfig reducedMotion="user">
        <FinalExamSession key={state.id} initial={state} onFinished={setState} />
      </MotionConfig>
    );
  }

  return (
    <>
      <AppHeader>
        <Link href="/kabinet/imtihon" aria-label="Yakuniy imtihon" className={buttonClasses({ variant: "secondary", size: "icon", className: "size-11 md:size-10" })}>
          <ArrowLeftIcon className="size-4.5" />
        </Link>
        <span className="truncate text-sm font-semibold text-foreground">Yakuniy ichki imtihon</span>
      </AppHeader>
      {error ? (
        <main className="mx-auto w-full max-w-md px-5 py-10">
          <Card role="alert" className="flex flex-col items-center gap-4 p-8 text-center">
            <p className="text-sm text-foreground">{error}</p>
            <Button variant="secondary" onClick={load}>
              <RotateCcwIcon className="size-4" />
              Qayta urinish
            </Button>
          </Card>
        </main>
      ) : !state ? (
        <main className="mx-auto w-full max-w-3xl px-5 py-8">
          <div className="skeleton-shimmer h-48 rounded-2xl" />
        </main>
      ) : (
        <MotionConfig reducedMotion="user">
          <FinalExamResult state={state} />
        </MotionConfig>
      )}
    </>
  );
}
