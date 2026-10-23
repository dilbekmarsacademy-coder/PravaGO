"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ClockIcon, KeyRoundIcon } from "lucide-react";
import { COURSE_TOPICS, keywordsHref, testHref, topicDayNumber } from "@/data/curriculum";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { Card } from "@/components/shared/Card";
import { Badge } from "@/components/shared/Badge";
import { buttonClasses } from "@/components/shared/Button";
import { LessonView } from "@/components/lesson/LessonView";

interface MavzuPageProps {
  params: Promise<{ id: string }>;
}

export default function MavzuPage({ params }: MavzuPageProps) {
  const { id } = use(params);
  const { locale, t } = useLocale();
  const topic = COURSE_TOPICS.find((item) => item.id === id);

  if (!topic) {
    notFound();
  }

  // Video darsli mavzu: avval video, test (bo'lsa) — video oxirigacha ko'rilgach.
  if (topic.lessonId) {
    return <LessonView topic={{ ...topic, lessonId: topic.lessonId }} />;
  }

  // Video yo'q, lekin test banki ulangan — to'g'ridan-to'g'ri testga.
  const testLink = topic.testSlug ? testHref(topic.testSlug) : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10 text-center sm:px-8">
      <Card className="relative flex w-full max-w-md flex-col items-center gap-5 overflow-hidden px-6 py-10 sm:px-10">
        <div
          className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-brand/20 blur-[80px]"
          aria-hidden="true"
        />
        <span className="glow-orange relative flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 font-mono text-xl font-bold text-background tabular-nums">
          {topic.order}
        </span>
        <div className="relative w-full">
          <span className="font-mono text-xs tracking-[0.2em] text-brand uppercase">
            {t.kabinet.topicPage.dayTopic(topicDayNumber(topic), topic.order)}
          </span>
          <h1 className="mt-2 font-display text-xl leading-snug font-bold break-words text-foreground sm:text-2xl">
            {localize(topic.title, locale)}
          </h1>
          {!testLink && (
            <>
              <Badge tone="brand" className="mt-4">
                <ClockIcon className="size-3" /> {t.kabinet.topic.comingSoon}
              </Badge>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.kabinet.topicPage.soon}</p>
            </>
          )}
        </div>
        {testLink && (
          <Link href={testLink} className={buttonClasses({ variant: "primary", size: "md", className: "relative" })}>
            {t.kabinet.continueCard.stages.test}
          </Link>
        )}
        {testLink && (
          <Link href={keywordsHref(topic)} className={buttonClasses({ variant: "secondary", size: "md", className: "relative" })}>
            <KeyRoundIcon className="size-4" />
            {t.keywords.open}
          </Link>
        )}
        <Link
          href="/kabinet"
          className={buttonClasses({ variant: "secondary", size: "md", className: "relative" })}
        >
          <ArrowLeftIcon className="size-4" />
          {t.kabinet.backToKabinet}
        </Link>
      </Card>
    </main>
  );
}
