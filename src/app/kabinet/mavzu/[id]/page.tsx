"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ConstructionIcon } from "lucide-react";
import { COURSE_TOPICS } from "@/data/curriculum";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { Card } from "@/components/shared/Card";
import { buttonClasses } from "@/components/shared/Button";

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

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-10 text-center sm:px-8">
      <Card className="flex max-w-md flex-col items-center gap-4 p-10">
        <span className="flex size-14 items-center justify-center rounded-full bg-foreground/5 text-brand">
          <ConstructionIcon className="size-6" />
        </span>
        <div>
          <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            {t.kabinet.topic.testNo(topic.number)} &middot; {t.kabinet.topic.questions(topic.questionCount)}
          </span>
          <h1 className="mt-1 font-display text-xl font-bold text-foreground">
            {localize(topic.title, locale)}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.kabinet.topicPage.soon}</p>
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
