"use client";

import { use, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { TestSession } from "@/components/test/TestSession";
import { isCollectionSlug, listCollections } from "@/lib/api/collections";
import type { LocalizedText } from "@/lib/i18n/localized";

interface TestPageProps {
  params: Promise<{ topicSlug: string }>;
}

export default function TestPage({ params }: TestPageProps) {
  const { topicSlug } = use(params);
  // `attempt` remounts <TestSession> on restart so all quiz state resets
  // naturally, instead of imperatively clearing state inside an effect.
  const [attempt, setAttempt] = useState(0);
  // "Xatolarni qayta ishlash": faqat shu savollar bilan yangi urinish.
  const [onlyQuestionIds, setOnlyQuestionIds] = useState<string[] | null>(null);
  // "Yangi testlar" to'plami kurs dasturida yo'q — sarlavha backend'dan.
  const [collectionTitle, setCollectionTitle] = useState<LocalizedText | undefined>(undefined);
  useEffect(() => {
    if (!isCollectionSlug(topicSlug)) return;
    listCollections()
      .then((list) => setCollectionTitle(list.find((c) => c.slug === topicSlug)?.title))
      .catch(() => undefined);
  }, [topicSlug]);

  return (
    <MotionConfig reducedMotion="user">
      <TestSession
        key={attempt}
        source={{ kind: "topic", topicSlug }}
        onlyQuestionIds={onlyQuestionIds}
        fallbackTitle={collectionTitle}
        onRestart={() => {
          setOnlyQuestionIds(null);
          setAttempt((a) => a + 1);
        }}
        onRetryWrong={(ids) => {
          setOnlyQuestionIds(ids);
          setAttempt((a) => a + 1);
        }}
      />
    </MotionConfig>
  );
}
