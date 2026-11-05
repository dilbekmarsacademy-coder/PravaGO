"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { getAiConfigured } from "@/lib/admin/content";
import NewTopicQuestionForm from "@/components/admin/question/NewTopicQuestionForm";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/admin/ui";

/** Kun mavzusi testiga yangi savol qo'shish (lotin → AI → tasdiqlash). */
export default function AdminNewTopicQuestionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [topic, setTopic] = useState<{ title: string; total: number } | null>(null);
  const [ai, setAi] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAiConfigured().then(setAi);
    adminFetch<{ topic: { title: string; titleCyrl: string | null }; total: number }>(`content/topics/${slug}/questions?filter=all`)
      .then((d) => setTopic({ title: d.topic.title !== slug ? d.topic.title : d.topic.titleCyrl ?? slug, total: d.total }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Xatolik"));
  }, [slug]);

  return (
    <>
      <Link href={`/admin/content/${slug}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeftIcon className="size-4" /> {topic?.title ?? slug}
      </Link>
      <PageHeader
        title="Yangi savol qo'shish"
        subtitle={<span>Savol, javoblar va to&apos;g&apos;ri javobni lotin yozuvida kiriting — kirill va rus tilini AI tayyorlaydi.{topic ? ` Hozir testda ${topic.total} ta savol.` : ""}</span>}
      />
      {error ? <ErrorBlock message={error} /> : !topic || ai === null ? <LoadingBlock /> : <NewTopicQuestionForm slug={slug} topicTitle={topic.title} aiConfigured={ai} />}
    </>
  );
}
