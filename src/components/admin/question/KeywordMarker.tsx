"use client";

import { useEffect, useRef, useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { addRange, removeRange, selectionOffsets, trimRange, type Range } from "@/lib/admin/keywords";
import { splitHighlight } from "@/lib/keywords/highlight";
import { KEYWORD_MARK_CLASS, type KeywordTone } from "@/components/keywords/KeywordText";

interface KeywordMarkerProps {
  text: string;
  ranges: Range[] | undefined;
  tone: KeywordTone;
  label: string;
  onChange: (ranges: Range[]) => void;
  disabled?: boolean;
}

/** Belgilangan bo'laklar bilan matn (sariq — savol kaliti, yashil — javob kaliti). */
export function MarkedText({ text, ranges, tone, className }: { text: string; ranges: Range[] | undefined; tone: KeywordTone; className?: string }) {
  const segments = splitHighlight(text, ranges?.length ? ranges : undefined);
  if (!segments) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {segments.map((s, i) =>
        s.marked ? (
          <mark key={i} className={cn("rounded-md px-0.5 font-semibold [box-decoration-break:clone]", KEYWORD_MARK_CLASS[tone])}>
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  );
}

/**
 * Matnda so'zni sichqoncha yoki barmoq bilan belgilab, kalit so'z bo'lagi
 * sifatida qo'shish. Bir nechta bo'lak mumkin; bo'lakni × bilan olib tashlash.
 */
export default function KeywordMarker({ text, ranges, tone, label, onChange, disabled }: KeywordMarkerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Range | null>(null);

  // Telefonda tugma bosilganda tanlov yo'qolishi mumkin — oxirgi tanlovni eslab qolamiz.
  useEffect(() => {
    function onSelectionChange() {
      const root = rootRef.current;
      const sel = window.getSelection();
      if (!root || !sel || sel.rangeCount === 0) return;
      const offsets = selectionOffsets(root, sel);
      if (offsets) setSelection(trimRange(text, offsets));
      else if (sel.anchorNode && root.contains(sel.anchorNode)) setSelection(null);
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [text]);

  function add() {
    if (!selection) return;
    onChange(addRange(ranges, selection));
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <button
          type="button"
          // Tanlov saqlanib qolishi uchun fokus tugmaga o'tmaydi.
          onPointerDown={(e) => e.preventDefault()}
          onClick={add}
          disabled={disabled || !selection}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-opacity disabled:opacity-40",
            tone === "question" ? "bg-warning/20 text-warning" : "bg-success/15 text-success",
          )}
        >
          <PlusIcon className="size-3.5" />
          {tone === "question" ? "Savol kaliti" : "Javob kaliti"}
        </button>
      </div>
      <div
        ref={rootRef}
        className={cn(
          "rounded-xl border border-dashed border-border-strong bg-background/40 px-3 py-2.5 text-[0.95rem] leading-relaxed select-text",
          disabled && "opacity-50",
        )}
        data-testid={`kw-root-${tone}`}
      >
        {text ? <MarkedText text={text} ranges={ranges} tone={tone} /> : <span className="text-muted-foreground">Matn yo&apos;q</span>}
      </div>
      {ranges && ranges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ranges.map(([s, e], i) => (
            <span key={`${s}-${e}`} className={cn("inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs font-semibold", KEYWORD_MARK_CLASS[tone])}>
              {text.slice(s, e)}
              <button type="button" onClick={() => onChange(removeRange(ranges, i))} aria-label="Bo'lakni olib tashlash" className="rounded-full p-0.5 hover:bg-foreground/10">
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
