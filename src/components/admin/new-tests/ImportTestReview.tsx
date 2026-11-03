"use client";

// Bitta import testini tekshirish: nom, kurs mavzusi, to'plam; savol kartochkalari;
// "Fayldagi javoblarni tasdiqlash" (faqat xavfsizlari) va "Tasdiqlash va chiqarish".

import { useCallback, useEffect, useState } from "react";
import { CheckCheckIcon, CopyPlusIcon, RocketIcon, SaveIcon } from "lucide-react";
import { adminFetch, AdminApiError } from "@/lib/admin/api";
import type { TestGroup } from "@/lib/admin/collections";
import type { ImportTestRow, ReviewQuestion } from "@/lib/admin/ai-import";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { showToast } from "@/components/shared/Toast";
import { Field, LoadingBlock, Panel, Select, Spinner, Tabs, TextInput } from "@/components/admin/ui";
import ImportQuestionCard from "./ImportQuestionCard";

type Filter = "all" | "review";

export default function ImportTestReview({ batchId, test, tests, onChanged }: { batchId: string; test: ImportTestRow; tests: ImportTestRow[]; onChanged: () => void }) {
  const [items, setItems] = useState<ReviewQuestion[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [title, setTitle] = useState(test.title);
  const [topicSlug, setTopicSlug] = useState(test.linkedTopicSlug ?? "");
  const [groupId, setGroupId] = useState(test.groupId ?? "");
  const [groups, setGroups] = useState<TestGroup[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const locked = test.status === "approved";

  const load = useCallback(async () => {
    try {
      const res = await adminFetch<{ items: ReviewQuestion[] }>(`ai-imports/${batchId}/tests/${test.id}/questions?filter=${filter}`);
      setItems(res.items);
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    }
  }, [batchId, test.id, filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    adminFetch<TestGroup[]>("test-groups")
      .then(setGroups)
      .catch(() => undefined);
  }, []);

  const refresh = useCallback(() => {
    load();
    onChanged();
  }, [load, onChanged]);

  async function saveMeta() {
    setBusy(true);
    try {
      await adminFetch(`ai-imports/${batchId}/tests/${test.id}`, {
        method: "PATCH",
        json: { title: title.trim(), ...(topicSlug ? { linkedTopicSlug: topicSlug } : { unlinkTopic: true }), ...(groupId ? { groupId } : {}) },
      });
      showToast({ message: "Saqlandi", tone: "success" });
      onChanged();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function approveFileAnswers() {
    setBusy(true);
    try {
      const r = await adminFetch<{ approved: number; remaining: number }>(`ai-imports/${batchId}/tests/${test.id}/approve-file-answers`, { method: "POST" });
      showToast({ message: `${r.approved} ta savol tasdiqlandi. Qo'lda tekshirish kerak: ${r.remaining}`, tone: "success" });
      refresh();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      await adminFetch(`ai-imports/${batchId}/tests/${test.id}/publish`, { method: "POST" });
      setConfirm(false);
      showToast({ message: "Test “Yangi testlar”ga chiqarildi", tone: "success", action: { label: "Ko'rish", href: "/admin/new-tests" } });
      onChanged();
    } catch (err) {
      showToast({ message: err instanceof AdminApiError && err.code === "NOT_ALL_APPROVED" ? "Avval barcha savollarni tasdiqlang" : err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!items || filter !== "all") return;
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    await adminFetch(`ai-imports/${batchId}/tests/${test.id}/reorder`, { json: { ids: next.map((q) => q.id) } }).catch(() => load());
  }

  const allApproved = test.questionCount > 0 && test.approvedCount === test.questionCount;

  async function includeExisting() {
    setBusy(true);
    try {
      await adminFetch(`ai-imports/${batchId}/tests/${test.id}/include-existing`, { method: "POST" });
      showToast({ message: `${test.existingCount} ta savol qo'shildi — AI tahlili davom etmoqda`, tone: "success" });
      refresh();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          {test.title}
          {locked ? <Badge tone="success">Chiqarilgan</Badge> : <Badge tone="muted">Qoralama</Badge>}
        </span>
      }
      className="mb-6"
    >
      {!locked && (
        <div className="mb-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
          <Field label="Test nomi">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} data-testid="ai-test-title" />
          </Field>
          <Field label="Kurs mavzusi" hint={test.linkedTopicSlug ? undefined : "Aniq mos kelmadi — tanlang"}>
            <Select value={topicSlug} onChange={(e) => setTopicSlug(e.target.value)}>
              <option value="">Bog&apos;lanmagan</option>
              {test.linkedTopicSlug && !test.suggestions.some((s) => s.slug === test.linkedTopicSlug) && <option value={test.linkedTopicSlug}>{test.linkedTopicSlug}</option>}
              {test.suggestions.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.slug} — {s.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To'plam">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="secondary" className="md:mb-5" disabled={busy || !title.trim()} onClick={saveMeta}>
            <SaveIcon className="size-4" /> Saqlash
          </Button>
        </div>
      )}

      {!locked && test.existingCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm" data-testid="ai-existing-notice">
          <p className="min-w-0 flex-1">
            Fayldagi yana <b>{test.existingCount} ta</b> savol saytda (kurs mavzularida) allaqachon bor, shuning uchun bu testga qo&apos;shilmadi. Bilet yoki to&apos;liq to&apos;plam bo&apos;lsa — ularni ham qo&apos;shing.
          </p>
          <Button size="sm" variant="secondary" disabled={busy} onClick={includeExisting} data-testid="ai-include-existing">
            <CopyPlusIcon className="size-4" /> Bu testga ham qo&apos;shish
          </Button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `Hammasi (${test.questionCount})` },
            { value: "review", label: `Tekshirish kerak (${test.reviewCount})` },
          ]}
        />
        <span className="text-sm text-muted-foreground">
          Tasdiqlangan: {test.approvedCount} / {test.questionCount}
        </span>
        {!locked && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={approveFileAnswers} data-testid="ai-approve-file">
              <CheckCheckIcon className="size-4" /> Fayldagi javoblarni tasdiqlash
            </Button>
            <Button size="sm" disabled={busy || !allApproved} onClick={() => setConfirm(true)} title={allApproved ? undefined : "Avval barcha savollarni tasdiqlang"} data-testid="ai-publish">
              <RocketIcon className="size-4" /> Tasdiqlash va chiqarish
            </Button>
          </div>
        )}
      </div>
      {!locked && (
        <p className="mb-4 text-xs text-muted-foreground">
          &ldquo;Fayldagi javoblarni tasdiqlash&rdquo; faqat javobi fayldan aniq olingan, ziddiyatsiz va rasmi muammosiz savollarni tasdiqlaydi. Sariq — AI javobi yoki shubha; qizil — rasm muammosi. Ular qo&apos;lda tekshiriladi.
        </p>
      )}

      {!items ? (
        <LoadingBlock />
      ) : !items.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{filter === "review" ? "Tekshirish kerak bo'lgan savol yo'q." : "Savollar yo'q."}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((q, i) => (
            <ImportQuestionCard
              key={q.id}
              q={q}
              index={i}
              locked={locked}
              tests={tests.filter((t) => t.status === "draft")}
              testId={test.id}
              onChanged={refresh}
              onMove={filter === "all" ? (dir) => move(i, dir) : undefined}
            />
          ))}
        </div>
      )}

      <Modal open={confirm} onOpenChange={setConfirm} title="Testni chiqarish" description={`“${title}” — ${test.questionCount} ta savol “Yangi testlar”ga qo'shiladi va o'quvchilarga ko'rinadi. Keyin tahrirlash “Yangi testlar” bo'limida.`}>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Bekor qilish
          </Button>
          <Button onClick={publish} disabled={busy} data-testid="ai-publish-confirm">
            {busy ? <Spinner className="size-4" /> : <RocketIcon className="size-4" />} Chiqarish
          </Button>
        </div>
      </Modal>
    </Panel>
  );
}
