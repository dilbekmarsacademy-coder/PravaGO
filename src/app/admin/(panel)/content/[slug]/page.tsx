"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import LessonPanel from "@/components/admin/LessonPanel";
import QuestionList, { type QuestionSummary } from "@/components/admin/QuestionList";
import { ErrorBlock, LoadingBlock, PageHeader, Panel, Tabs } from "@/components/admin/ui";

type Filter = "all" | "needsReview" | "noKeywords" | "noCorrect";

export default function AdminTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [filter, setFilter] = useState<Filter>("all");
  const [data, setData] = useState<{ topic: { title: string; titleCyrl: string | null }; total: number; items: QuestionSummary[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminFetch(`content/topics/${slug}/questions?filter=${filter}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }, [slug, filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <>
      <Link href="/admin/content" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeftIcon className="size-4" /> Kontent
      </Link>
      <PageHeader title={data ? (data.topic.title !== slug ? data.topic.title : data.topic.titleCyrl ?? slug) : slug} subtitle={<span className="font-mono">{slug}{data ? ` · ${data.total} savol` : ""}</span>} />
      <LessonPanel slug={slug} />
      <Tabs
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Hammasi" },
          { value: "needsReview", label: "Tekshirilmagan" },
          { value: "noKeywords", label: "Kalit so'zsiz" },
          { value: "noCorrect", label: "Javobsiz" },
        ]}
      />
      {error && <ErrorBlock message={error} onRetry={load} />}
      <Panel>{!data ? <LoadingBlock /> : <QuestionList items={data.items} hrefFor={(id) => `/admin/questions/${id}`} />}</Panel>
    </>
  );
}
