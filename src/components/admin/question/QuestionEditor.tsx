"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, LanguagesIcon, PlusIcon, SaveIcon, SparklesIcon, Trash2Icon, WandSparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { cyrillicToLatin, latinToCyrillic } from "@/lib/i18n/translit";
import { chipText, suggestRanges, textOf, type KwLang, type LangRanges, type Range, type Texts } from "@/lib/admin/keywords";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { Panel, Spinner, Tabs, TextArea, TextInput } from "@/components/admin/ui";
import ImageField from "@/components/admin/image/ImageField";
import KeywordMarker from "./KeywordMarker";
import QuestionPreview from "./QuestionPreview";
import { toPayload, validateDraft, type QuestionDraft } from "./draft";

type Script = "cyrl" | "latn";
type TextKey = keyof Texts;

const LANG_TABS: { value: KwLang; label: string }[] = [
  { value: "cyrl", label: "Кирилл" },
  { value: "uz", label: "Lotin" },
  { value: "ru", label: "Русский" },
];

const keyOf = (lang: KwLang): TextKey => (lang === "uz" ? "latn" : lang);
const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;

export interface TranslateResult {
  text: string;
  options: string[];
  explanation: string;
}

interface QuestionEditorProps {
  initial: QuestionDraft;
  mode: "edit" | "create";
  onSave: (payload: ReturnType<typeof toPayload>, draft: QuestionDraft) => Promise<void>;
  /** Ruscha AI tarjima (sozlanmagan bo'lsa — undefined). */
  onTranslate?: (draft: QuestionDraft) => Promise<TranslateResult>;
  aiConfigured: boolean;
  /** Saqlash tugmasi yonidagi qo'shimcha amallar (Tekshirildi, O'chirish ...). */
  actions?: ReactNode;
  /** Dublikat ogohlantiruvi kabi qo'shimcha blok (savol matni ostida). */
  textFooter?: (draft: QuestionDraft) => ReactNode;
  saveLabel?: string;
}

function convert(value: string, to: Script): string {
  return to === "latn" ? cyrillicToLatin(value) : latinToCyrillic(value);
}

export default function QuestionEditor({ initial, mode, onSave, onTranslate, aiConfigured, actions, textFooter, saveLabel }: QuestionEditorProps) {
  const [draft, setDraft] = useState<QuestionDraft>(initial);
  const [lang, setLang] = useState<KwLang>("cyrl");
  const [primary, setPrimary] = useState<Script>("cyrl");
  // Yangi savolda: bitta yozuvda yoziladi, ikkinchisi avtomatik transliteratsiya.
  const [autoTranslit, setAutoTranslit] = useState(mode === "create");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const correct = draft.correctIndex !== null ? draft.options[draft.correctIndex] : undefined;

  function update(fn: (d: QuestionDraft) => QuestionDraft) {
    setDraft((d) => fn(d));
    setError(null);
  }

  /** Matn o'zgarsa, shu tildagi belgilash eskiradi — tozalanadi. */
  function withText(t: Texts, key: TextKey, value: string): { texts: Texts; changed: TextKey[] } {
    const next = { ...t, [key]: value };
    const changed: TextKey[] = [key];
    if (autoTranslit && key === primary) {
      const other: Script = primary === "cyrl" ? "latn" : "cyrl";
      next[other] = convert(value, other);
      changed.push(other);
    }
    return { texts: next, changed };
  }

  function clearRanges(ranges: LangRanges, keys: TextKey[]): LangRanges {
    const out = { ...ranges };
    for (const key of keys) delete out[key === "latn" ? "uz" : key];
    return out;
  }

  function setQuestionText(key: TextKey, value: string) {
    update((d) => {
      const { texts, changed } = withText(d.text, key, value);
      return { ...d, text: texts, keywords: { ...d.keywords, question: clearRanges(d.keywords.question, changed) } };
    });
  }

  function setOptionText(index: number, key: TextKey, value: string) {
    update((d) => {
      const { texts, changed } = withText(d.options[index].text, key, value);
      const options = d.options.map((o, i) => (i === index ? { ...o, text: texts } : o));
      const answer = index === d.correctIndex ? clearRanges(d.keywords.answer, changed) : d.keywords.answer;
      return { ...d, options, keywords: { ...d.keywords, answer } };
    });
  }

  function setExplanation(key: TextKey, value: string) {
    update((d) => ({ ...d, explanation: withText(d.explanation, key, value).texts }));
  }

  function setCorrect(index: number) {
    update((d) => (d.correctIndex === index ? d : { ...d, correctIndex: index, keywords: { ...d.keywords, answer: {} } }));
  }

  function moveOption(index: number, dir: -1 | 1) {
    update((d) => {
      const target = index + dir;
      if (target < 0 || target >= d.options.length) return d;
      const options = [...d.options];
      [options[index], options[target]] = [options[target], options[index]];
      const correctIndex = d.correctIndex === index ? target : d.correctIndex === target ? index : d.correctIndex;
      return { ...d, options, correctIndex };
    });
  }

  function removeOption(index: number) {
    update((d) => {
      if (d.options.length <= MIN_OPTIONS) return d;
      const options = d.options.filter((_, i) => i !== index);
      if (d.correctIndex === index) return { ...d, options, correctIndex: null, keywords: { ...d.keywords, answer: {} } };
      const correctIndex = d.correctIndex !== null && d.correctIndex > index ? d.correctIndex - 1 : d.correctIndex;
      return { ...d, options, correctIndex };
    });
  }

  function addOption() {
    update((d) => (d.options.length >= MAX_OPTIONS ? d : { ...d, options: [...d.options, { text: { cyrl: "", latn: "", ru: "" } }] }));
  }

  /** Bir yozuvdan ikkinchisini to'liq to'ldirish (tahrirlash rejimida qo'lda). */
  function fillScript(to: Script) {
    const from: Script = to === "latn" ? "cyrl" : "latn";
    update((d) => {
      const fill = (t: Texts): Texts => (t[from] ? { ...t, [to]: convert(t[from], to) } : t);
      const lang: KwLang = to === "latn" ? "uz" : "cyrl";
      const question = { ...d.keywords.question };
      const answer = { ...d.keywords.answer };
      delete question[lang];
      delete answer[lang];
      return {
        ...d,
        text: fill(d.text),
        options: d.options.map((o) => ({ ...o, text: fill(o.text) })),
        explanation: fill(d.explanation),
        keywords: { ...d.keywords, question, answer },
      };
    });
    setNotice(`${to === "latn" ? "Lotin" : "Kirill"} yozuvi transliteratsiya bilan to'ldirildi — kalit so'zni shu yozuvda tasdiqlang.`);
  }

  async function translate() {
    if (!onTranslate) return;
    setTranslating(true);
    setError(null);
    try {
      const ru = await onTranslate(draft);
      update((d) => ({
        ...d,
        text: { ...d.text, ru: ru.text },
        options: d.options.map((o, i) => ({ ...o, text: { ...o.text, ru: ru.options[i] ?? o.text.ru } })),
        explanation: { ...d.explanation, ru: ru.explanation || d.explanation.ru },
        keywords: { ...d.keywords, question: clearRanges(d.keywords.question, ["ru"]), answer: clearRanges(d.keywords.answer, ["ru"]) },
        ruNeedsReview: true,
      }));
      setNotice("Ruscha tarjima AI bilan to'ldirildi (tekshirilmagan). Ruscha kalit so'zni belgilang.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tarjima qilinmadi");
    } finally {
      setTranslating(false);
    }
  }

  function setRanges(part: "question" | "answer", value: Range[]) {
    update((d) => ({ ...d, keywords: { ...d.keywords, [part]: { ...d.keywords[part], [lang]: value } } }));
  }

  // Bir o'zbek yozuvida belgilangan bo'lak uchun ikkinchisida taklif.
  const suggestions = useMemo(() => {
    if (lang === "ru" || draft.keywords.none) return [];
    const other: KwLang = lang === "uz" ? "cyrl" : "uz";
    const out: { part: "question" | "answer"; ranges: Range[]; preview: string }[] = [];
    for (const part of ["question", "answer"] as const) {
      const texts = part === "question" ? draft.text : correct?.text;
      if (!texts) continue;
      const own = draft.keywords[part][lang];
      const source = draft.keywords[part][other];
      if (own?.length || !source?.length) continue;
      const r = suggestRanges(textOf(texts, other), source, other === "uz" ? "uz" : "cyrl", textOf(texts, lang));
      if (r) out.push({ part, ranges: r, preview: chipText(textOf(texts, lang), r) });
    }
    return out;
  }, [lang, draft, correct]);

  async function save() {
    const problem = validateDraft(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(toPayload(draft), draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlanmadi");
    } finally {
      setSaving(false);
    }
  }

  const key = keyOf(lang);
  const scriptNote = lang !== "ru" && autoTranslit && key !== primary;

  const sections = [
    {
      title: "Rasm",
      hint: "Ixtiyoriy. Yuklangan rasm avtomatik tozalanadi — oldin/keyin ko'rinishida tasdiqlaysiz.",
      body: (
        <ImageField
          image={draft.image}
          onChange={(img, previewUrl) => {
            update((d) => ({ ...d, image: img, imageChange: img?.assetId ? { assetId: img.assetId } : img ? d.imageChange : { remove: true } }));
            setImagePreview(previewUrl ?? null);
          }}
        />
      ),
    },
    {
      title: "Savol matni",
      body: (
        <div className="flex flex-col gap-2">
          <TextArea
            value={draft.text[key]}
            onChange={(e) => setQuestionText(key, e.target.value)}
            placeholder={lang === "ru" ? "Текст вопроса" : lang === "cyrl" ? "Савол матни" : "Savol matni"}
            className="min-h-24"
            name={`question-text-${lang}`}
          />
          {scriptNote && <p className="text-xs text-muted-foreground">Bu yozuv avtomatik to&apos;ldirilmoqda — kerak bo&apos;lsa tuzating.</p>}
          {textFooter?.(draft)}
        </div>
      ),
    },
    {
      title: "Variantlar va to'g'ri javob",
      hint: "2–6 ta variant. To'g'ri javob — aynan bitta (doira belgisi).",
      body: (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="To'g'ri javob">
          {draft.options.map((o, i) => (
            <div key={o.id ?? `new-${i}`} className={cn("flex items-center gap-2 rounded-xl border p-2", i === draft.correctIndex ? "border-success/60 bg-success/5" : "border-border")}>
              <button
                type="button"
                role="radio"
                aria-checked={i === draft.correctIndex}
                aria-label={`${i + 1}-variant to'g'ri javob`}
                onClick={() => setCorrect(i)}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  i === draft.correctIndex ? "border-success bg-success text-background" : "border-border-strong hover:border-success",
                )}
              >
                {i === draft.correctIndex && <CheckIcon className="size-4" strokeWidth={3} />}
              </button>
              <span className="font-mono text-xs font-bold text-muted-foreground">F{i + 1}</span>
              <TextInput value={o.text[key]} onChange={(e) => setOptionText(i, key, e.target.value)} className="flex-1" name={`option-${i}-${lang}`} placeholder={`${i + 1}-variant`} />
              <div className="flex shrink-0 items-center">
                <Button size="icon-sm" variant="ghost" onClick={() => moveOption(i, -1)} disabled={i === 0} aria-label="Yuqoriga">
                  <ArrowUpIcon className="size-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => moveOption(i, 1)} disabled={i === draft.options.length - 1} aria-label="Pastga">
                  <ArrowDownIcon className="size-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => removeOption(i)} disabled={draft.options.length <= MIN_OPTIONS} aria-label="Variantni o'chirish">
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={addOption} disabled={draft.options.length >= MAX_OPTIONS} className="self-start">
            <PlusIcon className="size-4" /> Variant qo&apos;shish
          </Button>
        </div>
      ),
    },
    {
      title: "Kalit so'zlar",
      hint: "Matnda so'zni belgilab, tugmani bosing. Har til alohida saqlanadi; bir nechta bo'lak mumkin.",
      body: (
        <div className="flex flex-col gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.keywords.none}
              onChange={(e) => update((d) => ({ ...d, keywords: { ...d.keywords, none: e.target.checked } }))}
              className="size-4 accent-[var(--brand)]"
              name="keywords-none"
            />
            Kalit so&apos;z mavjud emas
          </label>
          {!draft.keywords.none && (
            <>
              <KeywordMarker text={draft.text[key]} ranges={draft.keywords.question[lang]} tone="question" label="Savol matni" onChange={(r) => setRanges("question", r)} />
              {correct ? (
                <KeywordMarker text={correct.text[key]} ranges={draft.keywords.answer[lang]} tone="answer" label="To'g'ri javob" onChange={(r) => setRanges("answer", r)} />
              ) : (
                <p className="text-sm text-muted-foreground">Javob kaliti uchun avval to&apos;g&apos;ri javobni belgilang.</p>
              )}
              {suggestions.map((s) => (
                <div key={s.part} className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-brand/50 bg-brand/5 px-3 py-2 text-sm">
                  <WandSparklesIcon className="size-4 text-brand" />
                  <span>
                    {s.part === "question" ? "Savol" : "Javob"} kaliti uchun taklif (transliteratsiya): <b>{s.preview}</b>
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => setRanges(s.part, s.ranges)}>
                    Tasdiqlash
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>
      ),
    },
    {
      title: "Izoh",
      hint: "Ixtiyoriy",
      body: <TextArea value={draft.explanation[key]} onChange={(e) => setExplanation(key, e.target.value)} placeholder="Izoh" name={`explanation-${lang}`} />,
    },
  ];

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={lang} onChange={setLang} options={LANG_TABS} />
      {mode === "create" ? (
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          Yozuv:
          <select
            value={primary}
            onChange={(e) => {
              const next = e.target.value as Script;
              setPrimary(next);
              setLang(next === "latn" ? "uz" : "cyrl");
            }}
            className="rounded-full border border-border bg-background px-2 py-1 text-xs"
            name="primary-script"
          >
            <option value="cyrl">Kirillda yozaman</option>
            <option value="latn">Lotinda yozaman</option>
          </select>
          <input type="checkbox" checked={autoTranslit} onChange={(e) => setAutoTranslit(e.target.checked)} className="accent-[var(--brand)]" />
          avtomatik
        </label>
      ) : (
        <>
          <Button size="sm" variant="ghost" onClick={() => fillScript("latn")}>
            <LanguagesIcon className="size-4" /> Kirill → lotin
          </Button>
          <Button size="sm" variant="ghost" onClick={() => fillScript("cyrl")}>
            <LanguagesIcon className="size-4" /> Lotin → kirill
          </Button>
        </>
      )}
      <Button size="sm" variant="ghost" onClick={translate} disabled={!onTranslate || !aiConfigured || translating} title={aiConfigured ? undefined : "ANTHROPIC_API_KEY sozlanmagan"}>
        {translating ? <Spinner className="size-4" /> : <SparklesIcon className="size-4" />} Ruschaga AI tarjima
        {!aiConfigured && <Badge tone="muted">sozlanmagan</Badge>}
      </Button>
      {draft.ruNeedsReview && <Badge tone="warning">ruscha tekshirilmagan</Badge>}
    </div>
  );

  const footer = (
    <div className="flex flex-col gap-3">
      {notice && <p className="rounded-xl bg-info/10 px-3 py-2 text-sm text-foreground/90">{notice}</p>}
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={saving} data-testid="question-save">
          {saving ? <Spinner className="size-4 text-brand-foreground" /> : <SaveIcon className="size-4" />}
          {saveLabel ?? "Saqlash"}
        </Button>
        {actions}
      </div>
    </div>
  );

  if (mode === "create") {
    const last = sections.length;
    return (
      <div className="flex flex-col gap-4">
        {toolbar}
        <ol className="flex flex-wrap gap-1.5">
          {[...sections.map((s) => s.title), "Ko'rib chiqish"].map((title, i) => (
            <li key={title}>
              <button
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  i === step ? "bg-brand text-brand-foreground" : i < step ? "bg-success/15 text-success" : "bg-foreground/5 text-muted-foreground",
                )}
              >
                {i + 1}. {title}
              </button>
            </li>
          ))}
        </ol>
        {step < last ? (
          <Panel title={`${step + 1}. ${sections[step].title}`}>
            {sections[step].hint && <p className="mb-3 text-xs text-muted-foreground">{sections[step].hint}</p>}
            {sections[step].body}
            <div className="mt-5 flex gap-2">
              {step > 0 && (
                <Button variant="secondary" onClick={() => setStep(step - 1)}>
                  Orqaga
                </Button>
              )}
              <Button onClick={() => setStep(step + 1)} data-testid="wizard-next">
                Keyingi
              </Button>
            </div>
          </Panel>
        ) : (
          <Panel title="Ko'rib chiqish (telefon va kompyuter ko'rinishi)">
            <QuestionPreview draft={draft} imageSrc={imagePreview} />
            <div className="mt-5">{footer}</div>
          </Panel>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="sticky top-14 z-10 -mx-1 rounded-2xl bg-background/85 px-1 py-2 backdrop-blur-xl lg:top-0">{toolbar}</div>
        {sections.map((s, i) => (
          <Panel key={s.title} title={`${i + 1}. ${s.title}`}>
            {s.hint && <p className="mb-3 text-xs text-muted-foreground">{s.hint}</p>}
            {s.body}
          </Panel>
        ))}
        {footer}
      </div>
      <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
        <Panel title="Jonli preview">
          <QuestionPreview draft={draft} imageSrc={imagePreview} />
        </Panel>
      </div>
    </div>
  );
}
