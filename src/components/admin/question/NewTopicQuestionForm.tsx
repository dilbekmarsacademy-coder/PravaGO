"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangleIcon, ArrowLeftIcon, CheckIcon, PencilIcon, PlusIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { createTopicQuestion, prepareTopicQuestion, type KeywordMode, type PreparedQuestion } from "@/lib/admin/content";
import type { Range } from "@/lib/admin/keywords";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, Panel, Spinner, TextArea, TextInput } from "@/components/admin/ui";
import DuplicateWarning from "@/components/admin/DuplicateWarning";
import ImageField from "@/components/admin/image/ImageField";
import KeywordMarker from "./KeywordMarker";
import QuestionPreview from "./QuestionPreview";
import type { QuestionDraft, QuestionImage } from "./draft";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

const KEYWORD_MODES: { value: KeywordMode; label: string; hint: string }[] = [
  { value: "ai", label: "AI tanlasin", hint: "AI savol va to'g'ri javobdan kalit so'zni topadi (lotin, kirill, rus)." },
  { value: "manual", label: "O'zim belgilayman", hint: "Lotin matnda so'zni belgilang — AI kirill va rus tilidagi mosini topadi." },
];

interface Form {
  text: string;
  options: string[];
  correctIndex: number | null;
  explanation: string;
  mode: KeywordMode;
  question: Range[];
  answer: Range[];
}

const emptyForm = (): Form => ({ text: "", options: ["", "", ""], correctIndex: null, explanation: "", mode: "ai", question: [], answer: [] });

/** Tasdiqlash oynasidagi preview uchun AI natijasi muharrir formatiga. */
function toDraft(p: PreparedQuestion, image: QuestionImage | null): QuestionDraft {
  return { text: p.text, options: p.options, correctIndex: p.correctIndex, explanation: p.explanation, image, keywords: p.keywords, ruNeedsReview: false };
}

/** Belgilashlar kiritilgan matnga nisbatan; backend matnni trim qiladi — boshidagi bo'shliq qadar suriladi. */
function shiftRanges(text: string, ranges: Range[]): Range[] {
  const lead = text.length - text.trimStart().length;
  return ranges.map(([s, e]) => [s - lead, e - lead]);
}

/** Bo'sh javob qatorlari tashlab yuboriladi (to'g'ri javob bo'sh bo'lmasa). */
function filledOptions(form: Form): { options: string[]; correctIndex: number | null } {
  const kept = form.options.map((o, i) => ({ o, i })).filter(({ o }) => o.trim());
  const correctIndex = kept.findIndex(({ i }) => i === form.correctIndex);
  return { options: kept.map(({ o }) => o), correctIndex: correctIndex >= 0 ? correctIndex : null };
}

function check(form: Form): string | null {
  if (!form.text.trim()) return "Savol matnini yozing";
  const { options } = filledOptions(form);
  if (options.length < MIN_OPTIONS) return "Kamida 2 ta javob yozing";
  if (form.correctIndex === null) return "To'g'ri javobni belgilang (variant yonidagi doira)";
  if (!form.options[form.correctIndex].trim()) return "To'g'ri deb belgilangan javob bo'sh — matnini yozing";
  if (/[Ѐ-ӿ]/.test(form.text + form.options.join(""))) return "Savol va variantlarni lotin yozuvida yozing — kirill va rus tilini AI tayyorlaydi";
  if (form.mode === "manual" && (!form.question.length || !form.answer.length)) return "Savol kalitini ham, javob kalitini ham belgilang (yoki \"AI tanlasin\"ni tanlang)";
  return null;
}

/**
 * Kun mavzusiga yangi savol: admin lotinda savol, variantlar va to'g'ri javobni
 * kiritadi; AI kirill yozuvi, ruscha tarjima va (tanlansa) kalit so'zni
 * tayyorlaydi; admin tasdiqlash oynasida natijani ko'rib, testga qo'shadi.
 */
export default function NewTopicQuestionForm({ slug, topicTitle, aiConfigured }: { slug: string; topicTitle: string; aiConfigured: boolean }) {
  const [form, setForm] = useState<Form>(emptyForm);
  const [image, setImage] = useState<QuestionImage | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState<PreparedQuestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<{ id: string; order: number }[]>([]);

  function update(fn: (f: Form) => Form) {
    setForm(fn);
    setError(null);
  }

  // Matn o'zgarsa, belgilangan bo'laklar eskiradi — tozalanadi.
  const setText = (value: string) => update((f) => ({ ...f, text: value, question: [] }));
  const setOption = (i: number, value: string) =>
    update((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? value : o)), answer: i === f.correctIndex ? [] : f.answer }));
  const setCorrect = (i: number) => update((f) => (f.correctIndex === i ? f : { ...f, correctIndex: i, answer: [] }));
  const addOption = () => update((f) => (f.options.length >= MAX_OPTIONS ? f : { ...f, options: [...f.options, ""] }));
  const removeOption = (i: number) =>
    update((f) => {
      if (f.options.length <= MIN_OPTIONS) return f;
      const options = f.options.filter((_, j) => j !== i);
      if (f.correctIndex === i) return { ...f, options, correctIndex: null, answer: [] };
      return { ...f, options, correctIndex: f.correctIndex !== null && f.correctIndex > i ? f.correctIndex - 1 : f.correctIndex };
    });

  async function prepare() {
    const problem = check(form);
    if (problem) {
      setError(problem);
      return;
    }
    const filled = filledOptions(form);
    setPreparing(true);
    setError(null);
    try {
      const result = await prepareTopicQuestion(slug, {
        text: form.text.trim(),
        options: filled.options.map((o) => o.trim()),
        correctIndex: filled.correctIndex!,
        explanation: form.explanation.trim(),
        keywords:
          form.mode === "manual"
            ? { mode: "manual", question: shiftRanges(form.text, form.question), answer: shiftRanges(form.options[form.correctIndex!], form.answer) }
            : { mode: "ai" },
      });
      setPrepared(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI tayyorlay olmadi");
    } finally {
      setPreparing(false);
    }
  }

  async function confirm() {
    if (!prepared) return;
    setSaving(true);
    try {
      const q = await createTopicQuestion(slug, prepared, image?.assetId ?? undefined);
      setAdded((list) => [...list, { id: q.id, order: q.order }]);
      setPrepared(null);
      setForm(emptyForm());
      setImage(null);
      setImagePreview(null);
      showToast({ message: `Savol testga qo'shildi (${q.order}-savol)`, tone: "success" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setPrepared(null);
      setError(err instanceof Error ? err.message : "Saqlanmadi");
    } finally {
      setSaving(false);
    }
  }

  const correctText = form.correctIndex !== null ? form.options[form.correctIndex] : null;
  const correctLetter = prepared ? `F${prepared.correctIndex + 1}` : "";

  return (
    <div className="flex flex-col gap-4">
      {added.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm" data-testid="added-questions">
          <CheckIcon className="size-4 text-success" />
          <span>Shu sahifada {added.length} ta savol qo&apos;shildi:</span>
          {added.map((q) => (
            <Link key={q.id} href={`/admin/questions/${q.id}`} className="font-semibold text-brand hover:underline">
              {q.order}-savol
            </Link>
          ))}
          <Link href={`/admin/content/${slug}`} className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-brand">
            <ArrowLeftIcon className="size-3.5" /> {topicTitle}
          </Link>
        </div>
      )}

      {!aiConfigured && (
        <p className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <AlertTriangleIcon className="size-4 text-warning" /> AI sozlanmagan (ANTHROPIC_API_KEY) — kirill va ruscha matnni tayyorlab bo&apos;lmaydi.
        </p>
      )}

      <Panel title="1. Rasm">
        <p className="mb-3 text-xs text-muted-foreground">Ixtiyoriy. Yuklangan rasm avtomatik tozalanadi — oldin/keyin ko&apos;rinishida tasdiqlaysiz.</p>
        <ImageField
          image={image}
          onChange={(img, previewUrl) => {
            setImage(img);
            setImagePreview(previewUrl ?? null);
          }}
        />
      </Panel>

      <Panel title="2. Savol matni (lotin yozuvida)">
        <TextArea
          value={form.text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Masalan: Qaysi holatda quvib o'tish taqiqlanadi?"
          className="min-h-24"
          name="new-question-text"
          data-testid="new-question-text"
        />
        <div className="mt-2">
          <DuplicateWarning text={form.text} />
        </div>
      </Panel>

      <Panel title="3. Javoblar va to'g'ri javob">
        <p className="mb-3 text-xs text-muted-foreground">2–6 ta variant (bo&apos;sh qatorlar hisobga olinmaydi). To&apos;g&apos;ri javob yonidagi doirani bosing — aynan bitta.</p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="To'g'ri javob">
          {form.options.map((o, i) => (
            <div key={i} className={cn("flex items-center gap-2 rounded-xl border p-2", i === form.correctIndex ? "border-success/60 bg-success/5" : "border-border")}>
              <button
                type="button"
                role="radio"
                aria-checked={i === form.correctIndex}
                aria-label={`${i + 1}-variant to'g'ri javob`}
                onClick={() => setCorrect(i)}
                data-testid={`new-question-correct-${i}`}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  i === form.correctIndex ? "border-success bg-success text-background" : "border-border-strong hover:border-success",
                )}
              >
                {i === form.correctIndex && <CheckIcon className="size-4" strokeWidth={3} />}
              </button>
              <span className="font-mono text-xs font-bold text-muted-foreground">F{i + 1}</span>
              <TextInput value={o} onChange={(e) => setOption(i, e.target.value)} className="flex-1" name={`new-option-${i}`} placeholder={`${i + 1}-javob`} data-testid={`new-question-option-${i}`} />
              <Button size="icon-sm" variant="ghost" onClick={() => removeOption(i)} disabled={form.options.length <= MIN_OPTIONS} aria-label="Variantni o'chirish">
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={addOption} disabled={form.options.length >= MAX_OPTIONS} className="self-start">
            <PlusIcon className="size-4" /> Javob qo&apos;shish
          </Button>
        </div>
      </Panel>

      <Panel title="4. Kalit so'z">
        <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-label="Kalit so'z">
          {KEYWORD_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={form.mode === m.value}
              onClick={() => update((f) => ({ ...f, mode: m.value }))}
              data-testid={`new-question-kw-${m.value}`}
              className={cn(
                "flex flex-1 flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                form.mode === m.value ? "border-brand bg-brand/10" : "border-border hover:border-brand/50",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {m.value === "ai" ? <SparklesIcon className="size-4 text-brand" /> : m.value === "manual" ? <PencilIcon className="size-4" /> : null}
                {m.label}
              </span>
              <span className="text-xs text-muted-foreground">{m.hint}</span>
            </button>
          ))}
        </div>
        {form.mode === "manual" && (
          <div className="mt-4 flex flex-col gap-4">
            {form.text.trim() ? (
              <KeywordMarker text={form.text} ranges={form.question} tone="question" label="Savol kaliti" onChange={(r) => update((f) => ({ ...f, question: r }))} />
            ) : (
              <p className="text-sm text-muted-foreground">Avval savol matnini yozing.</p>
            )}
            {correctText?.trim() ? (
              <KeywordMarker text={correctText} ranges={form.answer} tone="answer" label="Javob kaliti" onChange={(r) => update((f) => ({ ...f, answer: r }))} />
            ) : (
              <p className="text-sm text-muted-foreground">Javob kaliti uchun to&apos;g&apos;ri javobni belgilang.</p>
            )}
          </div>
        )}
      </Panel>

      <Panel title="5. Izoh">
        <Field label="Izoh (ixtiyoriy, lotin yozuvida)">
          <TextArea value={form.explanation} onChange={(e) => update((f) => ({ ...f, explanation: e.target.value }))} placeholder="Nega bu javob to'g'ri" name="new-question-explanation" />
        </Field>
      </Panel>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={prepare} disabled={preparing || !aiConfigured} data-testid="new-question-prepare">
          {preparing ? <Spinner className="size-4 text-brand-foreground" /> : <SparklesIcon className="size-4" />}
          {preparing ? "AI tayyorlamoqda…" : "Tayyor — tasdiqlashga o'tish"}
        </Button>
        <span className="text-xs text-muted-foreground">AI savolni kirill yozuviga va rus tiliga o&apos;giradi; keyin natijani ko&apos;rib tasdiqlaysiz.</span>
      </div>

      <Dialog open={prepared !== null} onOpenChange={(open) => !open && !saving && setPrepared(null)}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-popover p-5 shadow-card sm:max-w-2xl sm:p-6"
          data-testid="new-question-confirm"
        >
          {prepared && (
            <>
              <div>
                <DialogTitle className="font-display text-lg font-bold">Savolni tasdiqlang</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-muted-foreground">Tasdiqlagach, savol shu mavzu testining oxiriga qo&apos;shiladi va saytda darhol ko&apos;rinadi.</DialogDescription>
              </div>
              <div className="flex items-stretch overflow-hidden rounded-xl border border-success/50 bg-success/10" data-testid="new-question-confirm-correct">
                <span className="flex w-14 shrink-0 items-center justify-center bg-success font-mono text-sm font-bold text-background">{correctLetter}</span>
                <span className="flex flex-col px-3 py-2">
                  <span className="text-xs font-semibold tracking-wide text-success uppercase">To&apos;g&apos;ri javob</span>
                  <span className="font-medium text-foreground">{prepared.options[prepared.correctIndex].text.latn}</span>
                </span>
              </div>
              {prepared.warnings.length > 0 && (
                <ul className="flex flex-col gap-1 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                  {prepared.warnings.map((w) => (
                    <li key={w} className="flex gap-2">
                      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-warning" /> {w}
                    </li>
                  ))}
                </ul>
              )}
              <QuestionPreview draft={toDraft(prepared, image)} imageSrc={imagePreview} defaultLang="uz" />
              <p className="text-xs text-muted-foreground">Kirill va rus tilidagi matnni tillar tugmasida tekshiring. Kerak bo&apos;lsa keyin savol muharririda tuzatish mumkin.</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => setPrepared(null)} disabled={saving} data-testid="new-question-back">
                  <PencilIcon className="size-4" /> Orqaga, tahrirlash
                </Button>
                <Button onClick={confirm} disabled={saving} autoFocus data-testid="new-question-confirm-yes">
                  {saving ? <Spinner className="size-4 text-brand-foreground" /> : <CheckIcon className="size-4" />} Tasdiqlash — testga qo&apos;shish
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
