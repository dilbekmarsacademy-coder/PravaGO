import { HTMLAttributes } from "react";

type Tone = "paper" | "asphalt";

interface RetroCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
}

const TONE_CLASSES: Record<Tone, string> = {
  paper: "bg-paper text-ink border-asphalt shadow-[6px_6px_0_0_#1c1b19]",
  asphalt:
    "bg-asphalt-light text-paper border-paper-dark shadow-[6px_6px_0_0_#F0AA1F]",
};

export default function RetroCard({
  tone = "paper",
  className = "",
  children,
  ...rest
}: RetroCardProps) {
  return (
    <div
      {...rest}
      className={`border-[3px] p-5 sm:p-7 ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
