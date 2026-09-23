import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon, ListChecksIcon, VideoIcon } from "lucide-react";
import { PASS_PERCENT } from "@/config/rules";
import type { ContinueTarget } from "@/lib/progress/unlock";

interface ContinueCardProps {
  target: ContinueTarget;
}

const STAGE_META = {
  video: { icon: VideoIcon, label: "Video darsni ko'ring" },
  pdf: { icon: BookOpenIcon, label: "Kalit so'zlarni o'qing" },
  test: { icon: ListChecksIcon, label: "Testni topshiring" },
};

export default function ContinueCard({ target }: ContinueCardProps) {
  const { topic } = target;
  const meta = STAGE_META[topic.stage];
  const Icon = meta.icon;

  const hasFailedAttempt =
    topic.stage === "test" && topic.lastPercent !== null && topic.lastPercent < PASS_PERCENT;
  const actionLabel = hasFailedAttempt
    ? `Testni qayta ishlang — oxirgi natija ${topic.lastPercent}%`
    : meta.label;

  return (
    <div className="glass relative overflow-hidden rounded-2xl p-6 sm:p-7">
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-neon-orange/20 blur-[80px]"
        aria-hidden="true"
      />

      <span className="font-mono text-xs tracking-[0.24em] text-neon-orange uppercase">
        Davom ettirish
      </span>

      <div className="mt-3 flex items-start gap-4">
        <span className="glow-orange flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 text-background">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <span className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
            {target.dayNumber}-kun &middot; {topic.topic.number}-mavzu
          </span>
          <h2 className="mt-0.5 font-display text-lg font-bold text-foreground sm:text-xl">
            {topic.topic.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{actionLabel}</p>
        </div>
      </div>

      <Link
        href={`/kabinet/mavzu/${topic.topic.id}`}
        className="glow-orange-hover mt-6 inline-flex h-auto items-center gap-2 rounded-full bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 py-2.5 text-sm font-bold text-background"
      >
        Davom ettirish
        <ArrowRightIcon className="size-4" />
      </Link>
    </div>
  );
}
