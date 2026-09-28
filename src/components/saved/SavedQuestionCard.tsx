"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, LockIcon, PlayCircleIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { AnswerOption, type AnswerState } from "@/components/test/AnswerOption";
import { QuestionImage } from "@/components/test/QuestionImage";
import type { SavedItem } from "@/lib/api/saved";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { formatAgo, topicBySlug } from "@/lib/saved/format";
import { NoteEditor } from "./NoteEditor";

export type SavedViewMode = "view" | "review";

interface SavedQuestionCardProps {
  item: SavedItem;
  mode: SavedViewMode;
  now: number;
  onRemove: () => void;
  onNoteSaved: (note: string | null) => void;
}

export function SavedQuestionCard({ item, mode, now, onRemove, onNoteSaved }: SavedQuestionCardProps) {
  const { locale, t } = useLocale();
  const labels = t.saved.item;
  const topic = topicBySlug(item.topicSlug);
  const text = localize(item.question.text, locale);
  const headingId = `saved-${item.questionId}`;
  // Takrorlash rejimida foydalanuvchi tanlagan variant (faqat shu kartada, serverga yuborilmaydi).
  const [picked, setPicked] = useState<string | null>(null);

  const locked = item.answerLocked || !item.correctOptionId;
  const reviewing = mode === "review" && !locked;
  const revealed = !locked && (mode === "view" || picked !== null);

  function optionState(optionId: string): AnswerState {
    if (!reviewing || picked === null) return "idle";
    if (optionId === item.correctOptionId) return "correct";
    if (optionId === picked) return "incorrect";
    return "dimmed";
  }

  return (
    <Card className="flex flex-col gap-4 p-4 sm:gap-5 sm:p-6">
      <article aria-labelledby={headingId} className="contents">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {topic && (
            <Badge tone="brand" className="max-w-full truncate normal-case tracking-normal">
              <span className="truncate">{localize(topic.title, locale)}</span>
            </Badge>
          )}
          {item.sourceMode === "exam" && <Badge tone="warning">{labels.sourceExam}</Badge>}
          <span className="font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase tabular-nums">
            {topic ? labels.location(topic.number, item.question.order) : labels.questionNo(item.question.order)}
          </span>
          <span className="text-muted-foreground" aria-hidden="true">
            ·
          </span>
          <time dateTime={item.createdAt} className="text-xs text-muted-foreground">
            {formatAgo(item.createdAt, now, t.saved.ago)}
          </time>
        </div>

        {text ? (
          <h3 id={headingId} className="text-lg leading-snug font-semibold text-balance text-foreground">
            {text}
          </h3>
        ) : (
          <h3 id={headingId} className="sr-only">
            {topic ? labels.location(topic.number, item.question.order) : labels.questionNo(item.question.order)}
          </h3>
        )}

        <QuestionImage
          src={item.question.imageUrl}
          alt={text || t.testSession.imageAlt}
          width={item.question.imageWidth}
          height={item.question.imageHeight}
          variant="card"
        />

        {reviewing && picked === null && <p className="text-sm text-muted-foreground">{labels.reviewHint}</p>}

        <ul className="flex flex-col gap-2.5">
          {item.question.options.map((option, index) => {
            const label = `F${index + 1}`;
            const optionText = localize(option.text, locale);
            return (
              <li key={option.id}>
                {reviewing ? (
                  <AnswerOption
                    label={label}
                    text={optionText}
                    state={optionState(option.id)}
                    disabled={picked !== null}
                    onSelect={() => setPicked(option.id)}
                  />
                ) : (
                  <StaticOption
                    label={label}
                    text={optionText}
                    correct={!locked && option.id === item.correctOptionId}
                    correctLabel={labels.correctAnswer}
                  />
                )}
              </li>
            );
          })}
        </ul>

        {reviewing && picked !== null && (
          <div className="flex flex-wrap items-center justify-between gap-3" role="status">
            <span className={cn("text-sm font-bold", picked === item.correctOptionId ? "text-success" : "text-danger")}>
              {picked === item.correctOptionId ? labels.reviewCorrect : labels.reviewWrong}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
              <RotateCcwIcon className="size-4" />
              {labels.reviewAgain}
            </Button>
          </div>
        )}

        {locked ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface px-4 py-3 text-sm font-medium text-muted-foreground">
            <LockIcon className="size-4.5 shrink-0" aria-hidden="true" />
            {labels.locked}
          </div>
        ) : (
          revealed &&
          item.keyword && (
            <div className="rounded-r-xl border-l-4 border-brand bg-brand/5 px-4 py-3">
              <p className="font-mono text-[0.65rem] font-bold tracking-[0.18em] text-brand uppercase">{labels.keyword}</p>
              <p className="mt-1 text-base leading-relaxed font-bold text-foreground">{localize(item.keyword, locale)}</p>
            </div>
          )
        )}

        <NoteEditor questionId={item.questionId} note={item.note} onSaved={onNoteSaved} />

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            variant="ghost"
            size="md"
            onClick={onRemove}
            className="-ml-3 hover:bg-danger/10 hover:text-danger"
          >
            <Trash2Icon className="size-4" />
            {labels.remove}
          </Button>
          {topic && (
            <Link
              href={`/kabinet/mavzu/${topic.id}`}
              className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-semibold text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
            >
              <PlayCircleIcon className="size-4.5" aria-hidden="true" />
              {labels.video}
            </Link>
          )}
        </div>
      </article>
    </Card>
  );
}

/** Ko'rish rejimidagi variant (bosilmaydi). To'g'risi — yashil border, ✓ va yorliq. */
function StaticOption({
  label,
  text,
  correct,
  correctLabel,
}: {
  label: string;
  text: string;
  correct: boolean;
  correctLabel: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-14 w-full items-stretch overflow-hidden rounded-2xl border",
        correct ? "border-2 border-success bg-success/10" : "border-border bg-surface",
      )}
    >
      <span
        className={cn(
          "flex w-12 shrink-0 items-center justify-center font-mono text-sm font-bold sm:w-14",
          correct ? "bg-success text-background" : "bg-foreground/5 text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span className="flex flex-1 flex-col justify-center gap-1 px-4 py-3">
        {correct && (
          <span className="font-mono text-[0.65rem] font-bold tracking-[0.14em] text-success uppercase">{correctLabel}</span>
        )}
        <span className="text-base leading-snug font-medium break-words text-foreground">{text}</span>
      </span>
      {correct && (
        <span className="flex shrink-0 items-center pr-4">
          <span className="flex size-7 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckIcon className="size-4" strokeWidth={3} aria-hidden="true" />
          </span>
        </span>
      )}
    </div>
  );
}
