"use client";

import { use, useState } from "react";
import { MotionConfig } from "framer-motion";
import { TestSession } from "@/components/test/TestSession";

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

  return (
    <MotionConfig reducedMotion="user">
      <TestSession
        key={attempt}
        source={{ kind: "topic", topicSlug }}
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
