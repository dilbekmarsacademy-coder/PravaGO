"use client";

import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { EmptyState } from "@/components/admin/ui";

export interface QuestionSummary {
  id: string;
  order: number;
  text: string;
  imageUrl: string | null;
  ruNeedsReview: boolean;
  keywordNeedsReview: boolean;
  hasKeywords: boolean;
  hasCorrect: boolean;
}

export default function QuestionList({ items, hrefFor }: { items: QuestionSummary[]; hrefFor: (id: string) => string }) {
  if (items.length === 0) return <EmptyState>Savol topilmadi</EmptyState>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((q) => (
        <li key={q.id}>
          <Link href={hrefFor(q.id)} className="flex items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:border-brand/60 hover:bg-surface">
            <span className="mt-0.5 w-8 shrink-0 font-mono text-xs font-bold text-muted-foreground">#{q.order}</span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm">{q.text}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {q.imageUrl && (
                  <Badge>
                    <ImageIcon className="size-3" /> rasm
                  </Badge>
                )}
                {!q.hasCorrect && <Badge tone="danger">javob belgilanmagan</Badge>}
                {q.ruNeedsReview && <Badge tone="warning">ruscha tekshirilmagan</Badge>}
                {q.keywordNeedsReview && <Badge tone="warning">kalit so&apos;z tekshirilmagan</Badge>}
                {!q.hasKeywords && <Badge tone="muted">kalit so&apos;zsiz</Badge>}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
