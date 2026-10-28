"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { buttonClasses, Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { showToast } from "@/components/shared/Toast";
import DeleteButton from "@/components/admin/DeleteButton";
import QuestionList from "@/components/admin/QuestionList";
import type { EditableQuestion } from "@/components/admin/question/draft";
import { ErrorBlock, Field, LoadingBlock, PageHeader, Panel, TextInput } from "@/components/admin/ui";

interface Data {
  collection: { id: string; slug: string; title: { uz: string; cyrl: string; ru: string }; published: boolean };
  items: EditableQuestion[];
}

export default function AdminCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [title, setTitle] = useState({ uz: "", cyrl: "", ru: "" });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await adminFetch<Data>(`collections/${id}/questions`);
      setData(d);
      setTitle(d.collection.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function patch(body: object, message: string) {
    try {
      await adminFetch(`collections/${id}`, { method: "PATCH", json: body });
      showToast({ message, tone: "success" });
      load();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    }
  }

  async function remove() {
    await adminFetch(`collections/${id}`, { method: "DELETE" });
    showToast({ message: "To'plam o'chirildi — kabinetdan ham olindi", tone: "success" });
    router.push("/admin/new-tests");
  }

  async function removeQuestion(qid: string) {
    await adminFetch(`questions/${qid}`, { method: "DELETE" });
    showToast({ message: "Savol o'chirildi", tone: "success" });
    load();
  }

  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!data) return <LoadingBlock />;
  const c = data.collection;

  return (
    <>
      <Link href="/admin/new-tests" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeftIcon className="size-4" /> Yangi testlar
      </Link>
      <PageHeader
        title={c.title.uz}
        subtitle={<span className="font-mono">{c.slug}</span>}
        actions={
          <>
            {c.published ? <Badge tone="success">nashr qilingan</Badge> : <Badge tone="muted">qoralama</Badge>}
            <Button size="sm" variant={c.published ? "secondary" : "primary"} onClick={() => patch({ published: !c.published }, c.published ? "Qoralamaga qaytarildi" : "Nashr qilindi")} data-testid="collection-publish">
              {c.published ? "Qoralamaga" : "Nashr qilish"}
            </Button>
            <Link href={`/admin/new-tests/${id}/new`} className={buttonClasses({ size: "sm" })} data-testid="add-question">
              <PlusIcon className="size-4" /> Test qo&apos;shish
            </Link>
          </>
        }
      />
      <Panel title="Nomi (3 tilda)" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Lotin">
            <TextInput value={title.uz} onChange={(e) => setTitle({ ...title, uz: e.target.value })} />
          </Field>
          <Field label="Kirill">
            <TextInput value={title.cyrl} onChange={(e) => setTitle({ ...title, cyrl: e.target.value })} />
          </Field>
          <Field label="Rus">
            <TextInput value={title.ru} onChange={(e) => setTitle({ ...title, ru: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => patch({ title }, "Nom saqlandi")} disabled={!title.uz.trim()}>
            Nomni saqlash
          </Button>
          <DeleteButton label="To'plamni o'chirish" confirmLabel="Ha, to'plamni o'chirish" onDelete={remove} testId="collection-delete" />
        </div>
      </Panel>
      <Panel title={`Savollar (${data.items.length})`}>
        <QuestionList
          items={data.items.map((q) => ({
            id: q.id,
            order: q.order,
            text: q.text.latn || q.text.cyrl,
            imageUrl: q.image?.url ?? null,
            ruNeedsReview: q.ruNeedsReview,
            keywordNeedsReview: q.keywords.needsReview,
            hasKeywords: !q.keywords.none,
            hasCorrect: q.correctIndex !== null,
          }))}
          hrefFor={(qid) => `/admin/questions/${qid}`}
          actions={(qid) => <DeleteButton iconOnly label="Savolni o'chirish" onDelete={() => removeQuestion(qid)} testId="question-delete" />}
        />
      </Panel>
    </>
  );
}
