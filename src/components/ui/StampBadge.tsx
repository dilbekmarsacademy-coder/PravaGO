import { ReactNode } from "react";

interface StampBadgeProps {
  children: ReactNode;
  color?: "yellow" | "red";
  className?: string;
}

export default function StampBadge({
  children,
  color = "red",
  className = "",
}: StampBadgeProps) {
  const colorClass =
    color === "red"
      ? "border-signal-red text-signal-red"
      : "border-signal-yellow text-signal-yellow";

  return (
    <span
      className={`inline-flex -rotate-6 items-center justify-center rounded-full border-4 border-double px-4 py-2 font-display text-sm tracking-[0.2em] uppercase opacity-90 select-none ${colorClass} ${className}`}
    >
      {children}
    </span>
  );
}
