"use client";

// Video darsli mavzu sahifasi: video → (oxirigacha ko'rilgach) savollar va
// kalit so'zlar bilan tanishish → (hammasi bilan tanishilgach) test.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PlayCircleIcon } from "lucide-react";
import type { Topic } from "@/lib/course-types";
import { keywordsHref, testHref, topicDayNumber } from "@/data/curriculum";
import { LESSON_NOT_FOUND_CODE, getLessonStatus, type LessonStatus } from "@/lib/api/lessons";
import { ApiError } from "@/lib/api/session";
import { getReadyCounts } from "@/lib/api/ready";
import { getKeywordProgress, type KeywordProgress } from "@/lib/api/keywords";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { getRegistration, getUnlockAll } from "@/lib/registration-store";
import { getMe } from "@/lib/api/account";
import { AppHeader } from "@/components/shared/AppHeader";
import { buttonClasses } from "@/components/shared/Button";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { showToast } from "@/components/shared/Toast";
import { SecureVideoPlayer } from "./SecureVideoPlayer";
import { LessonTestGate } from "./LessonTestGate";

interface LessonViewProps {
  /** `testSlug` bo'lmasa — faqat video (test darvozasi ko'rsatilmaydi). */
  topic: Topic & { lessonId: string };
}

export function LessonView({ topic }: LessonViewProps) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [status, setStatus] = useState<LessonStatus | null>(null);
  // Darsga hali video ulanmagan (serverda yo'q) — holat-ekran, test qulflangan.
  const [unavailable, setUnavailable] = useState(false);
  // Testda hali javobi belgilangan savol yo'q — test "tez orada" (null — noma'lum, ulangan deb olinadi).
  const [testReady, setTestReady] = useState<boolean | null>(null);
  const testSlug = topic.testSlug;
  useEffect(() => {
    if (!testSlug) return;
    getReadyCounts()
      .then((counts) => setTestReady((counts[testSlug] ?? 1) > 0))
      .catch(() => undefined);
  }, [testSlug]);
  const hasTest = Boolean(testSlug) && testReady !== false;
  // Video ko'rilgach — nechta savol bilan tanishilgani (test shunga qarab ochiladi).
  const [keywordProgress, setKeywordProgress] = useState<KeywordProgress | null>(null);
  // Admin hamma narsani ochib qo'ygan o'quvchi (GET /me → kabinetda saqlangan); backend ham tekshiradi.
  const [unlockAll, setUnlockAll] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnlockAll(getUnlockAll());
  }, []);
  // Yangi oqim (video → kalit so'zlar → test) — serverdan (GET /me); backend ham tekshiradi.
  const [flowGating, setFlowGating] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        setFlowGating(Boolean(me.topicFlowGating));
        if (me.unlockAll !== undefined) setUnlockAll(Boolean(me.unlockAll));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const videoCompleted = Boolean(status?.completed);
  useEffect(() => {
    if (!testSlug || !videoCompleted) return;
    let cancelled = false;
    getKeywordProgress(testSlug)
      .then((next) => {
        if (!cancelled) setKeywordProgress(next);
      })
      .catch(() => undefined); // noma'lum bo'lsa test tugmasi ochiq; backend baribir tekshiradi
    return () => {
      cancelled = true;
    };
  }, [testSlug, videoCompleted]);
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
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404 && error.code === LESSON_NOT_FOUND_CODE) setUnavailable(true);
        // Boshqa xatolarni pleyer o'zi ko'rsatadi va qayta urinadi.
      });
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
        <p className="min-w-0 flex-1 truncate font-mono text-[0.65rem] font-semibold text-brand uppercase sm:text-xs sm:tracking-wide">
          {t.kabinet.topicPage.dayTopic(topicDayNumber(topic), topic.order)}
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
          freeSeek={unlockAll}
          onProgress={setStatus}
          onUnavailable={() => setUnavailable(true)}
          onCompleted={() => showToast({ tone: "success", message: hasTest ? t.lesson.gate.videoDone : t.lesson.gate.unlocked })}
        />

        {!unavailable && (
          <p className="hidden text-center text-xs text-muted-foreground pointer-fine:block">
            {t.lesson.player.keyboardHint}
          </p>
        )}

        {/* Test sahifasi ulanmagan bo'lsa tugma "tez orada" modalini ochadi. */}
        <LessonTestGate
          status={status}
          unavailable={unavailable}
          testHref={hasTest && testSlug ? testHref(testSlug) : null}
          keywordsHref={hasTest ? keywordsHref(topic) : null}
          keywordProgress={keywordProgress}
          unlockAll={unlockAll}
          flowGating={flowGating}
        />
      </main>
    </>
  );
}
