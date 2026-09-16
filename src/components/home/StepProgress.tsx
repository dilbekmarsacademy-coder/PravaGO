import { Step } from "./types";

const FLOW: Step[] = [
  "video",
  "guide",
  "category",
  "register",
  "otp",
  "payment",
];

const LABELS: Record<Step, string> = {
  hero: "Boshlash",
  video: "Video dars",
  guide: "Qo'llanma",
  category: "Toifa",
  register: "Ro'yxat",
  otp: "Tasdiqlash",
  payment: "To'lov",
};

export default function StepProgress({ step }: { step: Step }) {
  if (step === "hero") return null;

  const currentIndex = FLOW.indexOf(step);

  return (
    <div className="mx-auto mb-8 flex w-full max-w-2xl items-center justify-between gap-1 px-1">
      <span className="whitespace-nowrap font-mono text-xs tracking-widest text-signal-yellow uppercase">
        {currentIndex + 1}/{FLOW.length} — {LABELS[step]}
      </span>
      <div className="flex flex-1 gap-1">
        {FLOW.map((s, i) => (
          <div
            key={s}
            className={`h-2 flex-1 border border-asphalt-lighter ${
              i <= currentIndex ? "bg-signal-yellow" : "bg-asphalt-light"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
