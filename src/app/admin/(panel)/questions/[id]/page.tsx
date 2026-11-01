"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckCheckIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { getAiConfigured, translateDraft } from "@/lib/admin/content";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import DeleteButton from "@/components/admin/DeleteButton";
import QuestionEditor from "@/components/admin/question/QuestionEditor";
import { draftFromQuestion, type EditableQuestion } from "@/components/admin/question/draft";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/admin/ui";

export default function AdminQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [question, setQuestion] = useState<EditableQuestion | null>(null);
  const [version, setVersion] = useState(0);
  const [ai, setAi] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!question) return <LoadingBlock />;

  const isCollection = question.topicKind === "collection";
  const back = isCollection ? `/admin/new-tests/${question.topicId}` : `/admin/content/${question.topicSlug}`;
  const needsReview = question.ruNeedsReview || question.keywords.needsReview;

  async function markReviewed() {
    const updated = await adminFetch<EditableQuestion>(`questions/${id}/reviewed`, { method: "POST" });
    setQuestion(updated);
    setVersion((v) => v + 1);
    showToast({ message: "Tekshirildi deb belgilandi", tone: "success" });
  }

  async function remove() {
    await adminFetch(`questions/${id}`, { method: "DELETE" });
    showToast({ message: "Savol o'chirildi", tone: "success" });
    router.push(back);
  }

  return (
    <>
      <Link href={back} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeftIcon className="size-4" /> {isCollection ? "To'plam" : question.topicSlug}
      </Link>
      <PageHeader title={`Savol #${question.order}`} subtitle={<span className="font-mono">{question.topicSlug}</span>} />
      {question.answerPending && (
        <p className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground" data-testid="pending-note">
          Bu savolning to&apos;g&apos;ri javobi manbada belgilanmagan edi. To&apos;g&apos;ri javobni belgilab saqlang — savol hozircha o&apos;quvchiga
          ko&apos;rinmaydi. Barcha javoblarni belgilab bo&apos;lgach, Statistika yoki Kontent sahifasidagi <b>&quot;Tugatdim&quot;</b> tugmasini bosing —
          shunda savollar saytga chiqadi.
        </p>
      )}
      <QuestionEditor
        key={`${question.id}-${version}`}
        mode="edit"
        initial={draftFromQuestion(question)}
        aiConfigured={ai}
        onTranslate={translateDraft}
        onSave={async (payload) => {
          const updated = await adminFetch<EditableQuestion>(`questions/${id}`, { method: "PUT", json: payload });
          if (updated.answerPending) {
            // Javobsiz savollar ro'yxatiga qaytamiz — keyingisini belgilash uchun.
            showToast({ message: "Saqlandi. \"Tugatdim\" bosilgach saytga chiqadi", tone: "success" });
            router.push(`/admin/content/${updated.topicSlug}?filter=pending`);
            return;
          }
          setQuestion(updated);
          setVersion((v) => v + 1);
          showToast({ message: "Saqlandi — saytda darhol ko'rinadi", tone: "success" });
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
