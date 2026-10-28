"use client";

import { useState } from "react";
import { ArrowRightIcon, KeyRoundIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveAssetUrl } from "@/lib/api/test";
import { chipText, textOf, type KwLang } from "@/lib/admin/keywords";
import { formatUzLatin } from "@/lib/i18n/translit";
import { KEYWORD_MARK_CLASS } from "@/components/keywords/KeywordText";
import { Tabs } from "@/components/admin/ui";
import { MarkedText } from "./KeywordMarker";
import type { QuestionDraft } from "./draft";

const LANG_LABEL: Record<KwLang, string> = { cyrl: "Кирилл", uz: "Lotin", ru: "Русский" };

/** Saytdagi ko'rinish: javob berilgandan keyingi holat (to'g'ri javob yashil, kalit so'zlar belgilangan). */
export default function QuestionPreview({ draft, imageSrc }: { draft: QuestionDraft; imageSrc?: string | null }) {
  const [lang, setLang] = useState<KwLang>("cyrl");
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const show = (s: string) => (lang === "uz" ? formatUzLatin(s) : s);
  const questionText = textOf(draft.text, lang);
  const correct = draft.correctIndex !== null ? draft.options[draft.correctIndex] : undefined;
  const kw = draft.keywords;
  const qChip = kw.none ? "" : chipText(questionText, kw.question[lang]);
  const aChip = kw.none || !correct ? "" : chipText(textOf(correct.text, lang), kw.answer[lang]);
  const image = imageSrc ?? resolveAssetUrl(draft.image?.url ?? null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={lang} onChange={setLang} options={(Object.keys(LANG_LABEL) as KwLang[]).map((value) => ({ value, label: LANG_LABEL[value] }))} />
        <Tabs
          value={device}
          onChange={setDevice}
          options={[
            { value: "mobile", label: <SmartphoneIcon className="size-4" aria-label="Telefon" /> },
            { value: "desktop", label: <MonitorIcon className="size-4" aria-label="Kompyuter" /> },
          ]}
        />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-background p-3">
        <div className={cn("mx-auto flex flex-col gap-4 transition-[width]", device === "mobile" ? "w-[358px]" : "w-full max-w-3xl")} data-testid="question-preview">
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="max-h-72 w-full rounded-xl object-contain" />
          )}
          <p className={cn("font-display font-bold text-foreground", device === "mobile" ? "text-base" : "text-xl")}>
            {questionText ? (
              <MarkedText text={show(questionText)} ranges={kw.none ? undefined : kw.question[lang]} tone="question" />
            ) : (
              <span className="text-muted-foreground">Savol matni yo&apos;q</span>
            )}
          </p>
          <ol className={cn("grid gap-2", device === "desktop" && draft.options.length > 3 && "sm:grid-cols-2")}>
            {draft.options.map((o, i) => {
              const isCorrect = i === draft.correctIndex;
              const t = textOf(o.text, lang);
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm",
                    isCorrect ? "border-success/60 bg-success/10" : "border-border",
                  )}
                >
                  <span className="mt-0.5 font-mono text-xs font-bold text-muted-foreground">F{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    {isCorrect && !kw.none ? <MarkedText text={show(t)} ranges={kw.answer[lang]} tone="answer" /> : show(t) || "—"}
                  </span>
                </li>
              );
            })}
          </ol>
          {kw.none || (!qChip && !aChip) ? (
            <p className="inline-flex items-center gap-2 self-start rounded-full border border-dashed border-border-strong px-3 py-1.5 text-xs text-muted-foreground">
              <KeyRoundIcon className="size-3.5" /> Kalit so&apos;z mavjud emas
            </p>
          ) : (
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
              <span className={cn("rounded-full px-2.5 py-1", qChip ? KEYWORD_MARK_CLASS.question : "text-muted-foreground italic normal-case")}>
                {qChip ? show(qChip) : "yo'q"}
              </span>
              <ArrowRightIcon className="size-3.5 text-muted-foreground" />
              <span className={cn("rounded-full px-2.5 py-1", aChip ? KEYWORD_MARK_CLASS.answer : "text-muted-foreground italic normal-case")}>
                {aChip ? show(aChip) : "yo'q"}
              </span>
            </p>
          )}
          {textOf(draft.explanation, lang) && <p className="rounded-xl bg-surface p-3 text-sm text-muted-foreground">{show(textOf(draft.explanation, lang))}</p>}
        </div>
      </div>
    </div>
  );
}
