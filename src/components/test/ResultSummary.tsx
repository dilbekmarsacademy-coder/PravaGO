import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ResultSummaryProps {
  correctCount: number;
  total: number;
  onRestart: () => void;
}

export function ResultSummary({ correctCount, total, onRestart }: ResultSummaryProps) {
  const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Natija</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 px-4 py-6 text-center">
        <p className="text-3xl font-bold text-primary">
          {correctCount} / {total} to&apos;g&apos;ri ({percent}%)
        </p>
        <Button size="lg" onClick={onRestart}>
          Qayta boshlash
        </Button>
      </CardContent>
    </Card>
  );
}
