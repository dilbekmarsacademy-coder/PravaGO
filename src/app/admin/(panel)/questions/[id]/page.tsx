"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckCheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { getAiConfigured, translateDraft } from "@/lib/admin/content";
import { Button, buttonClasses } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import DeleteButton from "@/components/admin/DeleteButton";
import QuestionEditor from "@/components/admin/question/QuestionEditor";
import { draftFromQuestion, type EditableQuestion } from "@/components/admin/question/draft";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/admin/ui";

const FILTERS = ["needsReview", "noKeywords", "noCorrect", "pending"] as const;

export default function AdminQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [question, setQuestion] = useState<EditableQuestion | null>(null);
  const [ai, setAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mavzu ro'yxatidagi filtr (?filter=needsReview ...) — "keyingi savol" shu ro'yxat bo'yicha.
  const [filter, setFilter] = useState<string | null>(null);
  // Shu mavzu (yoki to'plam) savollari tartibda — oldingi/keyingi savol uchun.
  const [siblings, setSiblings] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    try {
      setQuestion(await adminFetch<EditableQuestion>(`questions/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    getAiConfigured().then(setAi);
  }, [load]);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("filter");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilter(value && (FILTERS as readonly string[]).includes(value) ? value : null);
  }, [id]);

  const topicKind = question?.topicKind;
  const topicId = question?.topicId;
  const topicSlug = question?.topicSlug;
  useEffect(() => {
    if (!topicKind || !topicId || !topicSlug) return;
    let cancelled = false;
    const path =
      topicKind === "collection" ? `collections/${topicId}/questions` : `content/topics/${topicSlug}/questions?filter=${filter ?? "all"}`;
    adminFetch<{ items: { id: string }[] }>(path)
      .then((d) => {
        if (!cancelled) setSiblings(d.items.map((q) => q.id));
      })
      .catch(() => undefined); // ro'yxat bo'lmasa — faqat oldingi/keyingi tugmalari ko'rinmaydi
    return () => {
      cancelled = true;
    };
  }, [topicKind, topicId, topicSlug, filter]);

  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!question) return <LoadingBlock />;

  const isCollection = question.topicKind === "collection";
  const filterQuery = filter ? `?filter=${filter}` : "";
  const back = isCollection ? `/admin/new-tests/${question.topicId}` : `/admin/content/${question.topicSlug}${filterQuery}`;
  const needsReview = question.ruNeedsReview || question.keywords.needsReview;
  const position = siblings ? siblings.indexOf(id) : -1;
  const prevId = position > 0 ? siblings![position - 1] : null;
  const nextId = position >= 0 && position + 1 < siblings!.length ? siblings![position + 1] : null;
  const hrefOf = (qid: string) => `/admin/questions/${qid}${filterQuery}`;

  /** Tekshirib bo'lingach — avtomatik keyingi savolga; oxirgisi bo'lsa mavzu ro'yxatiga. */
  function goNext(message: string) {
    if (nextId) {
      showToast({ message: `${message} — keyingi savol`, tone: "success" });
      router.push(hrefOf(nextId));
    } else {
      showToast({ message: `${message}. Bu ro'yxatdagi oxirgi savol edi`, tone: "success" });
      router.push(back);
    }
  }

  async function markReviewed() {
    await adminFetch<EditableQuestion>(`questions/${id}/reviewed`, { method: "POST" });
    goNext("Tekshirildi deb belgilandi");
  }

  async function remove() {
    await adminFetch(`questions/${id}`, { method: "DELETE" });
    showToast({ message: "Savol o'chirildi", tone: "success" });
    router.push(back);
  }

  return (
    <>
      <Link href={back} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeftIcon className="size-4" /> {isCollection ? "Test" : question.topicSlug}
      </Link>
      <PageHeader
        title={`Savol #${question.order}`}
        subtitle={<span className="font-mono">{question.topicSlug}</span>}
        actions={
          position >= 0 && siblings ? (
            <div className="flex items-center gap-2" data-testid="question-nav">
              {prevId ? (
                <Link href={hrefOf(prevId)} className={buttonClasses({ variant: "secondary", size: "sm" })} data-testid="question-prev">
                  <ChevronLeftIcon className="size-4" /> Oldingi
                </Link>
              ) : null}
              <span className="font-mono text-sm text-muted-foreground tabular-nums">
                {position + 1} / {siblings.length}
              </span>
              {nextId ? (
                <Link href={hrefOf(nextId)} className={buttonClasses({ variant: "secondary", size: "sm" })} data-testid="question-next">
                  Keyingi <ChevronRightIcon className="size-4" />
                </Link>
              ) : null}
            </div>
          ) : null
        }
      />
      {question.answerPending && (
        <p className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground" data-testid="pending-note">
          Bu savolning to&apos;g&apos;ri javobi manbada belgilanmagan edi. To&apos;g&apos;ri javobni belgilab saqlang — savol hozircha o&apos;quvchiga
          ko&apos;rinmaydi. Barcha javoblarni belgilab bo&apos;lgach, Statistika yoki Kontent sahifasidagi <b>&quot;Tugatdim&quot;</b> tugmasini bosing —
          shunda savollar saytga chiqadi.
        </p>
      )}
      <QuestionEditor
        key={question.id}
        mode="edit"
        initial={draftFromQuestion(question)}
        aiConfigured={ai}
        onTranslate={translateDraft}
        onSave={async (payload) => {
          const updated = await adminFetch<EditableQuestion>(`questions/${id}`, { method: "PUT", json: payload });
          // Saqlangach — ro'yxatdagi keyingi savolga (orqaga qaytib tanlash shart emas).
          goNext(updated.answerPending ? "Saqlandi. \"Tugatdim\" bosilgach saytga chiqadi" : "Saqlandi — saytda darhol ko'rinadi");
        }}
        actions={
          <>
            {needsReview && (
              <Button variant="secondary" onClick={markReviewed}>
                <CheckCheckIcon className="size-4" /> Tekshirildi
              </Button>
            )}
            {isCollection && (
              <DeleteButton label="Savolni o'chirish" onDelete={remove} testId="question-delete" />
            )}
          </>
        }
      />
    </>
  );
}
