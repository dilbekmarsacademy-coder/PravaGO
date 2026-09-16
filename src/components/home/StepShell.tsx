import { ReactNode } from "react";

interface StepShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function StepShell({ title, subtitle, children }: StepShellProps) {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-0">
      <h2 className="font-display text-4xl tracking-wide text-paper uppercase sm:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 font-body text-sm text-paper/70 sm:text-base">
          {subtitle}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}
