"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, PencilLineIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateSavedNote } from "@/lib/api/saved";
import { useLocale } from "@/lib/i18n/useLocale";

const NOTE_MAX = 500;
const AUTOSAVE_DELAY_MS = 800;

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface NoteEditorProps {
  questionId: string;
  note: string | null;
  onSaved: (note: string | null) => void;
}

/** Shaxsiy izoh: "Izoh qo'shish" → inline textarea, yozish to'xtagach avtomatik saqlanadi. */
export function NoteEditor({ questionId, note, onSaved }: NoteEditorProps) {
  const { t } = useLocale();
  const labels = t.saved.item;
  const id = useId();
  const [open, setOpen] = useState(note !== null);
  const [value, setValue] = useState(note ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const lastSaved = useRef(note ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  function save(text: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (text.trim() === lastSaved.current.trim()) return;
    setStatus("saving");
    const next = text.trim() ? text : null;
    updateSavedNote(questionId, next)
      .then((record) => {
        lastSaved.current = record.note ?? "";
        onSavedRef.current(record.note);
        setStatus("saved");
      })
      .catch(() => setStatus("error"));
  }

  // Karta yopilsa (olib tashlash, sahifadan chiqish) — kutib turgan o'zgarish yo'qolmasin.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        const text = valueRef.current;
        if (text.trim() !== lastSaved.current.trim()) {
          updateSavedNote(questionId, text.trim() ? text : null).catch(() => undefined);
        }
      }
    },
    [questionId],
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-full px-1 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand"
      >
        <PencilLineIcon className="size-4" aria-hidden="true" />
        {labels.addNote}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-mono text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase">
        {labels.noteLabel}
      </label>
      <textarea
        id={id}
        value={value}
        autoFocus={note === null}
        maxLength={NOTE_MAX}
        rows={2}
        placeholder={labels.notePlaceholder}
        onChange={(event) => {
          const text = event.target.value;
          setValue(text);
          setStatus("idle");
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => save(text), AUTOSAVE_DELAY_MS);
        }}
        onBlur={() => {
          save(value);
          if (!value.trim() && lastSaved.current === "") setOpen(false);
        }}
        className="field-sizing-content min-h-16 w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 sm:text-sm"
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span
          role="status"
          className={cn("inline-flex items-center gap-1", status === "error" && "text-danger", status === "saved" && "text-success")}
        >
          {status === "saving" && labels.noteSaving}
          {status === "saved" && (
            <>
              <CheckIcon className="size-3.5" aria-hidden="true" />
              {labels.noteSaved}
            </>
          )}
          {status === "error" && (
            <>
              <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
              {labels.noteError}
            </>
          )}
        </span>
        <span className="font-mono tabular-nums">
          {value.length}/{NOTE_MAX}
        </span>
      </div>
    </div>
  );
}
