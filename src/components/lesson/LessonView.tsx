"use client";

// Video darsli mavzu sahifasi: video → (oxirigacha ko'rilgach) test.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PlayCircleIcon } from "lucide-react";
import type { Topic } from "@/lib/course-types";
import { testHref } from "@/data/curriculum";
import { getLessonStatus, type LessonStatus } from "@/lib/api/lessons";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { getRegistration } from "@/lib/registration-store";
import { AppHeader } from "@/components/shared/AppHeader";
import { buttonClasses } from "@/components/shared/Button";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { showToast } from "@/components/shared/Toast";
import { SecureVideoPlayer } from "./SecureVideoPlayer";
import { LessonTestGate } from "./LessonTestGate";

interface LessonViewProps {
  topic: Topic & { lessonId: string; testSlug: string };
}

export function LessonView({ topic }: LessonViewProps) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [status, setStatus] = useState<LessonStatus | null>(null);
  const title = localize(topic.title, locale);

  // Kabinet bilan bir xil: ro'yxatdan o'tmagan / to'lovi faol bo'lmagan foydalanuvchi kirmaydi.
  // TODO(auth): real login qo'shilganda bu tekshiruv server sessiyasiga ko'chadi.
  useEffect(() => {
    const record = getRegistration();
    if (!record) router.replace("/");
    else if (record.status !== "active") router.replace("/tolov");
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    getLessonStatus(topic.lessonId)
      .then((next) => {
        if (!cancelled) setStatus((prev) => prev ?? next);
      })
      .catch(() => undefined); // pleyer o'zi xatoni ko'rsatadi va qayta urinadi
    return () => {
      cancelled = true;
    };
  }, [topic.lessonId]);

  return (
    <>
      <AppHeader>
        <Link
          href="/kabinet"
          aria-label={t.kabinet.backToKabinet}
          title={t.kabinet.backToKabinet}
          className={buttonClasses({ variant: "secondary", size: "icon", className: "size-11 md:size-10" })}
        >
          <ArrowLeftIcon className="size-4.5" />
        </Link>
        <p className="min-w-0 flex-1 truncate font-mono text-xs font-semibold tracking-wide text-brand uppercase">
          {t.kabinet.topic.testNo(topic.number)}
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle className="size-10" />
        </div>
      </AppHeader>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand uppercase">
            <PlayCircleIcon className="size-4" />
            {t.lesson.videoLabel}
          </p>
          <h1 className="mt-1.5 font-display text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
        </div>

        <SecureVideoPlayer
          lessonId={topic.lessonId}
          title={title}
          onProgress={setStatus}
          onCompleted={() => showToast({ tone: "success", message: t.lesson.gate.unlocked })}
        />

        <p className="hidden text-center text-xs text-muted-foreground pointer-fine:block">
          {t.lesson.player.keyboardHint}
        </p>

        <LessonTestGate status={status} testHref={testHref(topic.testSlug)} />
      </main>
    </>
  );
}
