import Link from "next/link";
import { CheckIcon, LockIcon, PlayIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TopicViewState } from "@/lib/progress/unlock";

interface TopicRowProps {
  topicState: TopicViewState;
}

const LOCKED_HINT = "Avvalgi mavzu testidan kamida 98% oling";

export default function TopicRow({ topicState }: TopicRowProps) {
  const { topic, completed, unlocked, bestPercent } = topicState;

  const statusIcon = completed ? (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neon-green/15 text-neon-green">
      <CheckIcon className="size-3.5" />
    </span>
  ) : unlocked ? (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neon-orange/15 text-neon-orange">
      <PlayIcon className="size-3.5" />
    </span>
  ) : (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground">
      <LockIcon className="size-3.5" />
    </span>
  );

  const content = (
    <>
      {statusIcon}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground/90">
          <span className="font-mono text-muted-foreground">{topic.number}.</span> {topic.title}
        </span>
      </span>
      {bestPercent !== null && (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.65rem] font-bold tabular-nums",
            completed ? "bg-neon-green/15 text-neon-green" : "bg-neon-amber/15 text-neon-amber",
          )}
        >
          {bestPercent}%
        </span>
      )}
    </>
  );

  if (!unlocked) {
    return (
      <div
        role="button"
        aria-disabled="true"
        title={LOCKED_HINT}
        className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 opacity-50"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/kabinet/mavzu/${topic.id}`}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-foreground/5"
    >
      {content}
    </Link>
  );
}
