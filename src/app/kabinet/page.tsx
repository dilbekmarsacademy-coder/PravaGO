"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcwIcon, SparklesIcon, TriangleAlertIcon } from "lucide-react";
import { getRegistration, clearRegistration, syncAccount, useRegistration } from "@/lib/registration-store";
import { getDashboardData, type DashboardData } from "@/lib/api/course";
import { clearSessionToken } from "@/lib/api/session";
import { resetSavedStore } from "@/lib/saved/store";
import { applyLocale, useLocale } from "@/lib/i18n/useLocale";
import { buildCourseState } from "@/lib/progress/unlock";
import type { ExamStatus } from "@/components/home/types";
import DashboardHeader from "@/components/kabinet/DashboardHeader";
import OverallProgress from "@/components/kabinet/OverallProgress";
import CourseMap from "@/components/kabinet/CourseMap";
import RandomTestBlock from "@/components/kabinet/RandomTestBlock";
import NewTestsBlock from "@/components/kabinet/NewTestsBlock";
import SavedCard from "@/components/kabinet/SavedCard";
import DeviceInfo from "@/components/kabinet/DeviceInfo";
import { Card } from "@/components/shared/Card";
import { buttonClasses } from "@/components/shared/Button";

type DataState = "loading" | "error" | "ready";

export default function KabinetPage() {
  const router = useRouter();
  const registration = useRegistration();
  const [dataState, setDataState] = useState<DataState>("loading");
  const [data, setData] = useState<DashboardData | null>(null);
  const { t } = useLocale();

  // Kirish huquqi serverdan (to'lov admin tomonidan tasdiqlangan bo'lishi kerak);
  // tarmoq xatosida klientdagi oxirgi ma'lum holat ishlatiladi.
  useEffect(() => {
    let cancelled = false;
    syncAccount()
      .then((me) => {
        if (cancelled) return;
        const local = getRegistration();
        if (!me.registered && !local) router.replace("/");
        else if (!me.access || !me.registered) router.replace("/tolov");
      })
      .catch(() => {
        if (cancelled) return;
        const record = getRegistration();
        if (!record) router.replace("/");
        else if (record.status !== "active") router.replace("/tolov");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Profilda saqlangan til (masalan, boshqa qurilmada tanlangan) cookie'dagidan ustun.
  useEffect(() => {
    const preferred = getRegistration()?.preferredLanguage;
    if (preferred && preferred !== document.documentElement.getAttribute("data-locale")) {
      applyLocale(preferred);
    }
  }, []);

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
    // Keyingi foydalanuvchi oldingisining saqlanganlarini ko'rmasligi uchun.
    clearSessionToken();
    resetSavedStore();
    router.push("/");
  }

  if (!registration || registration.status !== "active") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
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

      <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
        {dataState === "loading" && <DashboardSkeleton />}

        {dataState === "error" && (
          <Card className="flex flex-col items-center gap-4 p-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-danger/15 text-danger">
              <TriangleAlertIcon className="size-6" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                {t.kabinet.loadError.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.kabinet.loadError.desc}</p>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className={buttonClasses({ variant: "primary", size: "md", className: "mt-2" })}
            >
              <RotateCcwIcon className="size-4" />
              {t.kabinet.loadError.retry}
            </button>
          </Card>
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
  const { t } = useLocale();
  const courseState = buildCourseState(data.days, data.topics, data.topicProgress, data.examProgress);

  return (
    <div className="flex flex-col gap-6">
      {courseState.allRegularDaysCompleted ? (
        <Card className="relative overflow-hidden p-6 text-center sm:p-8">
          <div
            className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-success/20 blur-[80px]"
            aria-hidden="true"
          />
          <span className="glow-orange mx-auto flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-brand-foreground">
            <SparklesIcon className="size-6" />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold text-foreground sm:text-2xl">
            {t.kabinet.ready.title}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t.kabinet.ready.desc}
          </p>
        </Card>
      ) : null}

      <NewTestsBlock />

      <OverallProgress days={courseState.days} />

      <SavedCard />

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
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="skeleton-shimmer h-40 rounded-2xl" />
      <div className="skeleton-shimmer h-32 rounded-2xl" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
