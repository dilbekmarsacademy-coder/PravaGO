"use client";

import { use, useState } from "react";
import { MotionConfig } from "framer-motion";
import { TestSession } from "@/components/test/TestSession";

interface SavedTestPageProps {
  searchParams: Promise<{ topic?: string }>;
}

/** "Saqlanganlarni test qilib ishlash" — test sahifasining o'zi, savollar saqlanganlardan. */
export default function SavedTestPage({ searchParams }: SavedTestPageProps) {
  const { topic } = use(searchParams);
  const topicSlug = topic && /^[a-z0-9-]{1,120}$/.test(topic) ? topic : null;
  const [attempt, setAttempt] = useState(0);
  const [onlyQuestionIds, setOnlyQuestionIds] = useState<string[] | null>(null);

  return (
    <MotionConfig reducedMotion="user">
      <TestSession
        key={attempt}
        source={{ kind: "saved", topicSlug }}
        onlyQuestionIds={onlyQuestionIds}
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
