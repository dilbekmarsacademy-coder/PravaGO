"use client";

// Saytni foydalanuvchi uchun yopish / ochish: holat belgisi, qatordagi tugma,
// bir nechtasini tanlab ommaviy yopish/ochish. Backend: POST admin/users/site-access.
// Adminlar alohida jadvalda — bu yerdagi ro'yxatlarda faqat o'quvchilar bor,
// shuning uchun admin o'zini yoki boshqa adminni yopa olmaydi.

import { useCallback, useState, type FormEvent } from "react";
import { LockKeyholeIcon, LockKeyholeOpenIcon, XIcon } from "lucide-react";
import { adminFetch, AdminApiError } from "@/lib/admin/api";
import { formatDate } from "@/lib/admin/format";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { Field, Spinner, TextArea } from "@/components/admin/ui";
import { AdminDialog } from "./StudentDialogs";

export interface SiteAccessTarget {
  id: string;
  name: string;
  siteAccessBlocked?: boolean;
}

export interface SiteAccessResult {
  blocked: boolean;
  updated: number;
  unchanged: number;
  notFound: string[];
}

/** Qizil "Yopilgan" belgisi (sabab va sana — sarlavhada). */
export function SiteClosedBadge({ blockedAt, reason }: { blockedAt?: string | null; reason?: string | null }) {
  const title = ["Sayt yopilgan", blockedAt ? formatDate(blockedAt) : null, reason || null].filter(Boolean).join(" · ");
  return (
    <Badge tone="danger" title={title} data-testid="site-closed-badge">
      <LockKeyholeIcon className="size-3" aria-hidden="true" /> Yopilgan
    </Badge>
  );
}

/** Tanlangan qatorlar (joriy sahifada). */
export function useRowSelection() {
  const [selected, setSelected] = useState<Map<string, SiteAccessTarget>>(new Map());
  const toggle = useCallback((row: SiteAccessTarget) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, row);
      return next;
    });
  }, []);
  const setAll = useCallback((rows: SiteAccessTarget[], on: boolean) => {
    setSelected((prev) => {
      const next = new Map(prev);
      for (const r of rows) {
        if (on) next.set(r.id, r);
        else next.delete(r.id);
      }
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Map()), []);
  return { selected, toggle, setAll, clear };
}

export function SelectCheckbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate);
      }}
      onChange={onChange}
      aria-label={label}
      className="size-4 cursor-pointer accent-[var(--brand)]"
      data-testid="row-select"
    />
  );
}

/** Tanlanganlar uchun panel: "Saytni yopish" / "Saytni ochish". */
export function BulkSiteAccessBar({ selected, onAction, onClear }: { selected: SiteAccessTarget[]; onAction: (blocked: boolean) => void; onClear: () => void }) {
  if (selected.length === 0) return null;
  return (
    <div
      className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-brand/40 bg-popover/95 px-3 py-2 shadow-card backdrop-blur"
      data-testid="bulk-site-access"
    >
      <span className="text-sm font-semibold text-foreground">{selected.length} ta tanlandi</span>
      <span className="ml-auto flex flex-wrap gap-2">
        <Button size="sm" variant="danger" onClick={() => onAction(true)} data-testid="bulk-close">
          <LockKeyholeIcon className="size-4" /> Saytni yopish
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onAction(false)} data-testid="bulk-open">
          <LockKeyholeOpenIcon className="size-4" /> Saytni ochish
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onClear} aria-label="Tanlovni bekor qilish" title="Tanlovni bekor qilish">
          <XIcon className="size-4" />
        </Button>
      </span>
    </div>
  );
}

/** Qatordagi tugma: "Saytni yopish" yoki "Ochish". */
export function SiteAccessToggleButton({ blocked, onClick }: { blocked: boolean; onClick: () => void }) {
  const label = blocked ? "Saytni ochish" : "Saytni yopish";
  return (
    <Button size="icon-sm" variant="ghost" onClick={onClick} aria-label={label} title={label} data-testid="site-access-toggle">
      {blocked ? <LockKeyholeOpenIcon className="size-4 text-success" /> : <LockKeyholeIcon className="size-4 text-danger" />}
    </Button>
  );
}

/**
 * Tasdiqlash oynasi (bitta yoki bir nechta). Yopishda sabab ixtiyoriy.
 * `request` — null bo'lsa yopiq.
 */
export function SiteAccessDialog({
  request,
  onClose,
  onDone,
}: {
  request: { targets: SiteAccessTarget[]; blocked: boolean } | null;
  onClose: () => void;
  onDone: (result: SiteAccessResult) => void;
}) {
  const count = request?.targets.length ?? 0;
  const one = count === 1 ? request!.targets[0] : null;
  const title = request?.blocked ? "Saytni yopish" : "Saytni ochish";
  return (
    <AdminDialog
      open={request !== null}
      onOpenChange={(next) => !next && onClose()}
      title={title}
      description={
        request?.blocked
          ? `${one ? one.name : `${count} ta foydalanuvchi`} saytga kira olmaydi: kirgan qurilmalari darhol "Sayt siz uchun yopilgan" sahifasini ko'radi. Natijalar, to'lovlar va haftalik yangilanish o'zgarmaydi.`
          : `${one ? one.name : `${count} ta foydalanuvchi`} yana saytga kira oladi (markaz o'quvchisi qaytadan login qiladi).`
      }
    >
      {request && <SiteAccessForm key={request.targets.map((t) => t.id).join() + request.blocked} request={request} onDone={onDone} />}
    </AdminDialog>
  );
}

function SiteAccessForm({ request, onDone }: { request: { targets: SiteAccessTarget[]; blocked: boolean }; onDone: (result: SiteAccessResult) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await adminFetch<SiteAccessResult>("users/site-access", {
        json: { ids: request.targets.map((t) => t.id), blocked: request.blocked, ...(request.blocked && reason.trim() ? { reason: reason.trim() } : {}) },
      });
      showToast({
        message: request.blocked ? `Sayt yopildi: ${result.updated} ta` : `Sayt ochildi: ${result.updated} ta`,
        tone: "success",
      });
      onDone(result);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Bajarib bo'lmadi");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" data-testid="site-access-form">
      {request.targets.length > 1 && (
        <ul className="max-h-40 overflow-y-auto rounded-xl border border-border px-3 py-2 text-sm">
          {request.targets.map((t) => (
            <li key={t.id} className="truncate">
              {t.name}
            </li>
          ))}
        </ul>
      )}
      {request.blocked && (
        <Field label="Sabab (ixtiyoriy, faqat adminlar ko'radi)">
          <TextArea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} name="reason" />
        </Field>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant={request.blocked ? "danger" : "primary"} disabled={busy} className="self-start" data-testid="site-access-submit">
        {busy && <Spinner className="size-4" />}
        {request.blocked ? "Ha, saytni yopish" : "Ha, saytni ochish"}
      </Button>
    </form>
  );
}
