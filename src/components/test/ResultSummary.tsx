"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/useLocale";

interface ResultSummaryProps {
  correctCount: number;
  total: number;
  onRestart: () => void;
}

export function ResultSummary({ correctCount, total, onRestart }: ResultSummaryProps) {
  const { t } = useLocale();
  const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{t.testSession.resultTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 px-4 py-6 text-center">
        <p className="text-3xl font-bold text-primary">
          {t.testSession.resultScore(correctCount, total, percent)}
        </p>
        <Button size="lg" onClick={onRestart}>
          {t.testSession.restart}
        </Button>
      </CardContent>
    </Card>
  );
}
