"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { getAiConfigured, translateDraft } from "@/lib/admin/content";
import { showToast } from "@/components/shared/Toast";
import DuplicateWarning from "@/components/admin/DuplicateWarning";
import QuestionEditor from "@/components/admin/question/QuestionEditor";
import { emptyDraft } from "@/components/admin/question/draft";
import { PageHeader } from "@/components/admin/ui";

export default function AdminNewQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [ai, setAi] = useState(false);
  const [initial] = useState(emptyDraft);

  useEffect(() => {
    getAiConfigured().then(setAi);
  }, []);

  return (
    <>
      <Link href={`/admin/new-tests/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeftIcon className="size-4" /> To&apos;plam
      </Link>
      <PageHeader title="Test qo'shish" subtitle="Rasm → savol → variantlar → to'g'ri javob → kalit so'zlar → ko'rib chiqish" />
      <QuestionEditor
        mode="create"
        initial={initial}
        aiConfigured={ai}
        onTranslate={translateDraft}
        textFooter={(d) => <DuplicateWarning text={d.text.latn || d.text.cyrl} />}
        saveLabel="Saqlash"
        onSave={async (payload, draft) => {
          let body = payload;
          // Ruscha matn bo'lmasa va AI sozlangan bo'lsa — avtomatik tarjima (tekshirilmagan).
          if (ai && !draft.text.ru.trim()) {
            try {
              const ru = await translateDraft(draft);
              body = {
                ...payload,
                text: { ...payload.text, ru: ru.text },
                options: payload.options.map((o, i) => ({ ...o, text: { ...o.text, ru: ru.options[i] ?? "" } })),
                explanation: { ...payload.explanation, ru: ru.explanation },
                ruNeedsReview: true,
              };
            } catch {
              // Tarjimasiz saqlanadi — ruscha matn keyin qo'shiladi.
            }
          }
          await adminFetch(`collections/${id}/questions`, { json: { ...body, ruNeedsReview: body.ruNeedsReview || !body.text.ru } });
          showToast({ message: "Savol qo'shildi", tone: "success" });
          router.push(`/admin/new-tests/${id}`);
        }}
      />
    </>
  );
}
