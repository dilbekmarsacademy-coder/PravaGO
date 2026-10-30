"use client";

import { useEffect, useState, type FormEvent } from "react";
import { SaveIcon } from "lucide-react";
import { adminFetch, AdminApiError } from "@/lib/admin/api";
import { formatDateTime, formatClock, parseDuration } from "@/lib/admin/format";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import DeleteButton from "@/components/admin/DeleteButton";
import { ErrorBlock, Field, LoadingBlock, Panel, Spinner, TextInput } from "@/components/admin/ui";

export interface AdminLesson {
  lessonId: string;
  videoId: string;
  durationSec: number;
  defaultVideoId: string;
  defaultDurationSec: number;
  overridden: boolean;
  updatedAt: string | null;
}

// Mavzu video darsi: YouTube havolasini va davomiylikni almashtirish.
// Video ID faqat admin API'dan keladi (frontend kodida yozilmaydi).
export default function LessonPanel({ slug }: { slug: string }) {
  const [lesson, setLesson] = useState<AdminLesson | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState("");
  const [duration, setDuration] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function apply(next: AdminLesson | null) {
    setLesson(next);
    if (next) {
      setVideo(`https://youtu.be/${next.videoId}`);
      setDuration(formatClock(next.durationSec));
    }
  }

  useEffect(() => {
    adminFetch<{ lesson: AdminLesson | null }>(`content/topics/${slug}/lesson`)
      .then((res) => apply(res.lesson))
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  if (error) return <ErrorBlock message={error} />;
  if (lesson === undefined) return <LoadingBlock />;
  if (lesson === null) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const durationSec = parseDuration(duration);
    if (!durationSec) {
      setFormError("Davomiylikni daqiqa:soniya ko'rinishida yozing, masalan 7:58");
      return;
    }
    setBusy(true);
    try {
      apply(await adminFetch<AdminLesson>(`content/topics/${slug}/lesson`, { method: "PUT", json: { video: video.trim(), durationSec } }));
      showToast({ message: "Video saqlandi — saytda darhol ko'rinadi", tone: "success" });
    } catch (err) {
      setFormError(err instanceof AdminApiError ? err.message : "Saqlab bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    apply(await adminFetch<AdminLesson>(`content/topics/${slug}/lesson`, { method: "DELETE" }));
    showToast({ message: "Asl videoga qaytarildi", tone: "success" });
  }

  return (
    <Panel
      title="Video dars"
      className="mb-4"
      actions={lesson.overridden ? <Badge tone="warning">almashtirilgan · {formatDateTime(lesson.updatedAt)}</Badge> : <Badge>asl video</Badge>}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="aspect-video overflow-hidden rounded-xl border border-border bg-black">
          <iframe
            key={lesson.videoId}
            src={`https://www.youtube-nocookie.com/embed/${lesson.videoId}`}
            title="Video dars"
            className="size-full"
            allow="encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
        <form onSubmit={save} className="flex flex-col gap-4">
          <Field label="YouTube havolasi" hint="youtu.be/…, youtube.com/watch?v=… yoki video ID">
            <TextInput value={video} onChange={(e) => setVideo(e.target.value)} autoComplete="off" spellCheck={false} name="video" />
          </Field>
          <Field
            label="Davomiylik"
            hint="Videoning to'liq uzunligi (daqiqa:soniya). Talaba videoni oxirigacha ko'rgani shu bo'yicha hisoblanadi."
          >
            <TextInput value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" className="font-mono" name="duration" />
          </Field>
          {formError && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy || !video.trim() || !duration.trim()}>
              {busy ? <Spinner className="text-brand-foreground" /> : <SaveIcon className="size-4" />}
              Saqlash
            </Button>
            {lesson.overridden && (
              <DeleteButton
                label="Asl videoga qaytarish"
                confirmLabel={`Ha, qaytarish (${formatClock(lesson.defaultDurationSec)})`}
                onDelete={reset}
                testId="lesson-reset"
              />
            )}
          </div>
        </form>
      </div>
    </Panel>
  );
}
