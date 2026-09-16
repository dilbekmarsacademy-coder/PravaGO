import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface SectionProps {
  index: string;
  title: string;
  subtitle?: string;
  tone?: "default" | "soft";
  children: ReactNode;
}

export default function Section({
  index,
  title,
  subtitle,
  tone = "default",
  children,
}: SectionProps) {
  return (
    <section
      className={`w-full border-t border-border ${
        tone === "soft" ? "bg-muted/40" : "bg-background"
      }`}
    >
      <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="mb-4 flex items-center gap-3">
          <Badge variant="outline" className="font-mono">
            {index}
          </Badge>
          <h2 className="font-display text-3xl text-foreground sm:text-4xl">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="mb-8 max-w-lg text-muted-foreground">{subtitle}</p>
        )}
        <Separator className="mb-8" />
        {children}
      </div>
    </section>
  );
}
