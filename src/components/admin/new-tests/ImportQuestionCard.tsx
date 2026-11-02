"use client";

// Import savoli kartochkasi: matn (3 til), variantlar (to'g'ri javobni tanlash), kalitlar, izoh,
// manbalar, rasm (asl / tozalangan / kesilgan), ko'chirish, o'chirish va tasdiqlash.

import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, EraserIcon, ImageOffIcon, ImageUpIcon, Trash2Icon, UndoIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { CORRECT_BY_LABEL, imageUrl, type ImageVariant, type ImportTestRow, type ReviewQuestion, type Texts } from "@/lib/admin/ai-import";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { Field, Select, Spinner, TextArea, TextInput } from "@/components/admin/ui";
import WatermarkBoxEditor from "./WatermarkBoxEditor";

type Lang = keyof Texts;
const LANGS: { value: Lang; label: string }[] = [
  { value: "latn", label: "Lotin" },
  { value: "cyrl", label: "Кирилл" },
  { value: "ru", label: "Рус" },
];
const VARIANTS: { value: ImageVariant; label: string }[] = [
  { value: "original", label: "Asl" },
  { value: "cleaned", label: "Tozalangan" },
  { value: "crop", label: "Kesilgan" },
];
const MATCH_LABEL: Record<string, string> = {
  same_file: "bir faylda",
  matched: "fayllar mos keldi",
  ai_matched: "AI moslashtirdi",
  unmatched: "javob fayli topilmadi",
};

function letter(i: number) {
  return `F${i + 1}`;
}

export default function ImportQuestionCard({
  q,
  index,
  locked,
  tests,
  testId,
  onChanged,
  onMove,
}: {
  q: ReviewQuestion;
  index: number;
  locked: boolean;
  tests: ImportTestRow[];
  testId: string;
  onChanged: () => void;
  onMove?: (dir: -1 | 1) => void;
}) {
  const d = q.data;
  const [lang, setLang] = useState<Lang>(d.script === "cyrl" ? "cyrl" : "latn");
  const [text, setText] = useState<Texts>(d.text);
  const [options, setOptions] = useState<Texts[]>(d.options);
  const [explanation, setExplanation] = useState<Texts>(d.explanation ?? { cyrl: "", latn: "", ru: "" });
  const [keyQ, setKeyQ] = useState(d.keywords.question ?? "");
  const [keyA, setKeyA] = useState(d.keywords.answer ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [boxEditor, setBoxEditor] = useState(false);
  const [imgVersion, setImgVersion] = useState(0);

  async function patch(body: Record<string, unknown>, ok?: string) {
    setBusy(true);
    try {
      await adminFetch(`ai-imports/questions/${q.id}`, { method: "PATCH", json: body });
      if (ok) showToast({ message: ok, tone: "success" });
      setDirty(false);
      onChanged();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function post(path: string, body?: unknown) {
    setBusy(true);
    try {
      await adminFetch(path, body instanceof FormData ? { method: "POST", body } : { method: "POST", json: body ?? {} });
      setImgVersion((v) => v + 1);
      onChanged();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const hasExplanation = explanation.latn.trim() || explanation.cyrl.trim() || explanation.ru.trim();
    patch({ text, options, keywords: { question: keyQ.trim() || null, answer: keyA.trim() || null }, ...(hasExplanation ? { explanation } : { clearExplanation: true }) }, "Saqlandi");
  }

  const aiAnswer = d.correctSource === "ai" || d.correctIndex === null;
  const tone = q.imageProblem ? "border-danger/50" : q.review ? "border-warning/50" : q.approved ? "border-success/40" : "border-border";
  const img = q.image;

  return (
    <article className={`rounded-2xl border-2 bg-card p-4 ${tone}`} data-testid="ai-question" data-review={q.review ? "1" : "0"}>
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-bold">#{index + 1}</span>
        {q.approved && <Badge tone="success">Tasdiqlangan</Badge>}
        {d.correctIndex === null ? (
          <Badge tone="warning">Javob yo&apos;q</Badge>
        ) : aiAnswer ? (
          <Badge tone="warning">Javob AI taxmini</Badge>
        ) : (
          <Badge tone="muted">Javob fayldan: {d.correctBy ? CORRECT_BY_LABEL[d.correctBy] ?? d.correctBy : "—"}</Badge>
        )}
        {d.aiDoubt && <Badge tone="warning">AI shubha qildi</Badge>}
        {q.conflict && <Badge tone="warning">Fayllarda turli javob</Badge>}
        {(q.matchStatus === "ai_matched" || q.matchStatus === "unmatched") && <Badge tone="warning">{MATCH_LABEL[q.matchStatus]}</Badge>}
        {q.imageProblem && <Badge tone="danger">Rasm muammosi</Badge>}
        {d.ruNeedsReview && <Badge tone="muted">Ruscha — AI tarjima</Badge>}
        {d.confidence === "low" && <Badge tone="warning">Ishonch past</Badge>}
        <div className="ml-auto flex gap-1">
          {LANGS.map((l) => (
            <button key={l.value} type="button" onClick={() => setLang(l.value)} className={`rounded-full px-2.5 py-0.5 text-xs ${lang === l.value ? "bg-brand/15 font-semibold text-brand" : "text-muted-foreground hover:text-foreground"}`}>
              {l.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {locked ? (
            <p className="mb-3 font-semibold">{text[lang]}</p>
          ) : (
            <TextArea
              value={text[lang]}
              rows={2}
              className="mb-3 font-semibold"
              onChange={(e) => {
                setText({ ...text, [lang]: e.target.value });
                setDirty(true);
              }}
            />
          )}
          <ul className="mb-3 flex flex-col gap-2">
            {options.map((o, i) => {
              const correct = d.correctIndex === i;
              return (
                <li key={i} className={`flex items-start gap-2 rounded-xl border p-2 ${correct ? (aiAnswer ? "border-warning/60 bg-warning/10" : "border-success/50 bg-success/10") : "border-border"}`}>
                  <button
                    type="button"
                    disabled={locked || busy}
                    onClick={() => patch({ correctIndex: i, ...(q.conflict ? { resolveConflict: true } : {}) })}
                    aria-label={`${letter(i)} — to'g'ri javob`}
                    className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border ${correct ? "border-success bg-success text-white" : "border-border-strong hover:border-success"}`}
                    data-testid="ai-option-correct"
                  >
                    {correct && <CheckIcon className="size-3" />}
                  </button>
                  <span className="mt-0.5 text-xs font-bold text-muted-foreground">{letter(i)}</span>
                  {locked ? (
                    <span className="text-sm">{o[lang]}</span>
                  ) : (
                    <TextInput
                      value={o[lang]}
                      className="h-8 flex-1 text-sm"
                      onChange={(e) => {
                        setOptions(options.map((x, k) => (k === i ? { ...x, [lang]: e.target.value } : x)));
                        setDirty(true);
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          {d.aiDoubt && <p className="mb-2 rounded-lg bg-warning/10 p-2 text-xs text-warning">AI: {d.aiDoubt}</p>}
          {aiAnswer && d.aiReason && <p className="mb-2 rounded-lg bg-warning/10 p-2 text-xs text-warning">AI asosi: {d.aiReason}</p>}
          {q.conflict && (
            <div className="mb-2 rounded-lg bg-warning/10 p-2 text-xs text-warning">
              Turli fayllarda turli javob: {q.conflict.map((c) => `${c.fileName} → ${c.answer}`).join("; ")}. To&apos;g&apos;ri variantni tanlang.
            </div>
          )}
          {d.matchCandidate && q.matchStatus !== "matched" && q.matchStatus !== "same_file" && (
            <p className="mb-2 text-xs text-muted-foreground">
              Nomzod ({d.matchCandidate.fileName}): {d.matchCandidate.questionText ?? d.matchCandidate.answerText}
              {d.matchScore !== null && ` — o'xshashlik ${Math.round(d.matchScore * 100)}%`}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Savol kaliti${d.keywords.source === "ai" ? " (AI)" : ""}`}>
              <TextInput
                value={keyQ}
                disabled={locked}
                onChange={(e) => {
                  setKeyQ(e.target.value);
                  setDirty(true);
                }}
              />
            </Field>
            <Field label={`Javob kaliti${d.keywords.source === "ai" ? " (AI)" : ""}`}>
              <TextInput
                value={keyA}
                disabled={locked}
                onChange={(e) => {
                  setKeyA(e.target.value);
                  setDirty(true);
                }}
              />
            </Field>
          </div>
          <Field label={`Izoh${d.explanationSource === "ai" ? " (AI yozdi — tasdiqlangach o'quvchiga ko'rinadi)" : ""}`}>
            <TextArea
              rows={2}
              value={explanation[lang]}
              disabled={locked}
              onChange={(e) => {
                setExplanation({ ...explanation, [lang]: e.target.value });
                setDirty(true);
              }}
            />
          </Field>
          {d.problems.length > 0 && <p className="mb-2 text-xs text-muted-foreground">Muammolar: {d.problems.join("; ")}</p>}
          <p className="text-xs text-muted-foreground">Manba: {d.sources.map((s) => `${s.fileName} (${s.part === "question" ? "savol" : s.part === "answer" ? "javob" : "kalit"})`).join(", ") || "—"}</p>
        </div>

        <div>
          {img ? (
            <div data-testid="ai-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(img.id, img.selected === "crop" && !img.hasCrop ? "original" : img.selected, `${imgVersion}-${img.selected}`)} alt="" className="mb-2 w-full rounded-xl border border-border object-contain" />
              <div className="mb-2 grid grid-cols-3 gap-1.5">
                {VARIANTS.filter((v) => v.value === "original" || (v.value === "cleaned" ? img.hasCleaned : img.hasCrop)).map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    disabled={locked || busy}
                    onClick={() => post(`ai-imports/images/${img.id}/select`, { variant: v.value })}
                    className={`overflow-hidden rounded-lg border-2 text-[11px] ${img.selected === v.value ? "border-brand" : "border-transparent hover:border-border-strong"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl(img.id, v.value, imgVersion)} alt={v.label} className="aspect-video w-full object-cover" />
                    <span className="block py-0.5">{v.label}</span>
                  </button>
                ))}
              </div>
              {img.note && <p className="mb-2 text-xs text-danger">{img.note}</p>}
              {!locked && (
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => setBoxEditor(true)}>
                    <EraserIcon className="size-4" /> Qayta tozalash
                  </Button>
                  <label className="inline-flex">
                    <span className="sr-only">Rasmni almashtirish</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (!f) return;
                        const form = new FormData();
                        form.append("file", f, f.name);
                        post(`ai-imports/questions/${q.id}/image`, form);
                      }}
                    />
                    <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:bg-surface">
                      <ImageUpIcon className="size-4" /> Almashtirish
                    </span>
                  </label>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => post(`ai-imports/questions/${q.id}/image/remove`)}>
                    <ImageOffIcon className="size-4" /> Olib tashlash
                  </Button>
                </div>
              )}
              {boxEditor && (
                <WatermarkBoxEditor
                  imageId={img.id}
                  initial={img.boxes}
                  onClose={() => setBoxEditor(false)}
                  onDone={() => {
                    setBoxEditor(false);
                    setImgVersion((v) => v + 1);
                    onChanged();
                  }}
                />
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Rasm yo&apos;q</p>
          )}
        </div>
      </div>

      {!locked && (
        <footer className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {onMove && (
            <>
              <Button size="icon-sm" variant="ghost" aria-label="Yuqoriga" onClick={() => onMove(-1)}>
                <ArrowUpIcon className="size-4" />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Pastga" onClick={() => onMove(1)}>
                <ArrowDownIcon className="size-4" />
              </Button>
            </>
          )}
          {tests.length > 1 && (
            <Select className="h-9 w-auto text-sm" value={testId} onChange={(e) => patch({ testId: e.target.value }, "Boshqa testga ko'chirildi")} aria-label="Testga ko'chirish">
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id === testId ? "Shu testda" : `→ ${t.title}`}
                </option>
              ))}
            </Select>
          )}
          <Button size="sm" variant="danger" disabled={busy} onClick={() => patch({ deleted: true }, "Savol olib tashlandi")}>
            <Trash2Icon className="size-4" /> O&apos;chirish
          </Button>
          <div className="ml-auto flex gap-2">
            {dirty && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={save} data-testid="ai-question-save">
                {busy ? <Spinner className="size-4" /> : null} Saqlash
              </Button>
            )}
            {q.approved ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => post(`ai-imports/questions/${q.id}/approve`, { approved: false })}>
                <UndoIcon className="size-4" /> Tasdiqni bekor qilish
              </Button>
            ) : (
              <Button size="sm" disabled={busy || dirty || d.correctIndex === null} onClick={() => post(`ai-imports/questions/${q.id}/approve`, { approved: true })} title={dirty ? "Avval saqlang" : undefined} data-testid="ai-question-approve">
                <CheckIcon className="size-4" /> Tasdiqlash
              </Button>
            )}
          </div>
        </footer>
      )}
    </article>
  );
}
