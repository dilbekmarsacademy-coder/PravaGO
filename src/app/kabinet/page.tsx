"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcwIcon, SparklesIcon, TriangleAlertIcon } from "lucide-react";
import { getRegistration, clearRegistration, useRegistration } from "@/lib/registration-store";
import { getDashboardData, type DashboardData } from "@/lib/api/course";
import { buildCourseState } from "@/lib/progress/unlock";
import type { ExamStatus } from "@/components/home/types";
import DashboardHeader from "@/components/kabinet/DashboardHeader";
import ContinueCard from "@/components/kabinet/ContinueCard";
import OverallProgress from "@/components/kabinet/OverallProgress";
import CourseMap from "@/components/kabinet/CourseMap";
import RandomTestBlock from "@/components/kabinet/RandomTestBlock";
import DeviceInfo from "@/components/kabinet/DeviceInfo";

type DataState = "loading" | "error" | "ready";

export default function KabinetPage() {
  const router = useRouter();
  const registration = useRegistration();
  const [dataState, setDataState] = useState<DataState>("loading");
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const record = getRegistration();
    if (!record) {
      router.replace("/");
    } else if (record.status !== "active") {
      router.replace("/tolov");
    }
  }, [router]);

  async function loadData() {
    try {
      const result = await getDashboardData();
      setData(result);
      setDataState("ready");
    } catch {
      setDataState("error");
    }
  }

  useEffect(() => {
    // Mount vaqtida bir martalik mock so'rov — natija keyinchalik (`await`dan
    // so'ng) setState qilinadi, shuning uchun kaskad render xavfi yo'q.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  function handleRetry() {
    setDataState("loading");
    loadData();
  }

  function handleLogout() {
    clearRegistration();
    router.push("/");
  }

  if (!registration || registration.status !== "active") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-neon-orange border-t-transparent" />
      </main>
    );
  }

  return (
    <>
      <DashboardHeader
        firstName={registration.firstName}
        lastName={registration.lastName}
        examStatus={registration.examStatus}
        onLogout={handleLogout}
      />

      <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        {dataState === "loading" && <DashboardSkeleton />}

        {dataState === "error" && (
          <div className="glass flex flex-col items-center gap-4 rounded-2xl p-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-neon-red/15 text-neon-red">
              <TriangleAlertIcon className="size-6" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Ma&rsquo;lumotlarni yuklab bo&rsquo;lmadi
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Internet aloqasini tekshirib, qayta urinib ko&rsquo;ring.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="glow-orange-hover mt-2 inline-flex h-auto items-center gap-2 rounded-full bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 py-2.5 text-sm font-bold text-background"
            >
              <RotateCcwIcon className="size-4" />
              Qayta urinish
            </button>
          </div>
        )}

        {dataState === "ready" && data && (
          <DashboardContent
            data={data}
            examStatus={registration.examStatus}
          />
        )}
      </main>
    </>
  );
}

function DashboardContent({
  data,
  examStatus,
}: {
  data: DashboardData;
  examStatus: ExamStatus;
}) {
  const courseState = buildCourseState(data.days, data.topics, data.topicProgress, data.examProgress);

  return (
    <div className="flex flex-col gap-6">
      {courseState.allRegularDaysCompleted ? (
        <div className="glass relative overflow-hidden rounded-2xl p-6 text-center sm:p-8">
          <div
            className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-neon-green/20 blur-[80px]"
            aria-hidden="true"
          />
          <span className="glow-orange mx-auto flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 text-background">
            <SparklesIcon className="size-6" />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold text-foreground sm:text-2xl">
            Imtihonga tayyorsiz!
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Barcha 6 kunlik dastur muvaffaqiyatli tugatildi. Endi 7-kun yakuniy imtihoniga
            o&rsquo;tishingiz mumkin.
          </p>
        </div>
      ) : (
        courseState.continueTarget && <ContinueCard target={courseState.continueTarget} />
      )}

      <OverallProgress days={courseState.days} />

      <CourseMap
        courseState={courseState}
        examStatus={examStatus}
        examAttemptsUsed={data.examProgress.attempts.length}
        examMaxAttempts={data.examProgress.maxAttempts}
      />

      <RandomTestBlock />

      <DeviceInfo />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden="true">
      <div className="glass h-40 rounded-2xl bg-foreground/5" />
      <div className="glass h-32 rounded-2xl bg-foreground/5" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass h-16 rounded-2xl bg-foreground/5" />
        ))}
      </div>
    </div>
  );
}
