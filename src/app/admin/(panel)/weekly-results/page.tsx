"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { formatDateTime, formatPhone } from "@/lib/admin/format";
import { fullName, type Paged } from "@/lib/admin/types";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { showToast } from "@/components/shared/Toast";
import { weekLabel, type WeekSummary } from "@/components/admin/WeeklyResults";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Pagination, Panel, Select, StatCard, Table, Td, TextInput, Th } from "@/components/admin/ui";

interface ResetItem {
  weekKey: string;
  status: "running" | "done" | "failed" | "covered";
  triggeredBy: "cron" | "catchup" | "manual" | "initial";
  startedAt: string;
  finishedAt: string | null;
  affectedUsers: number;
  counts: { topicTests: number; randomTests: number; answers: number; aiInsights: number; videoProgress?: number; keywordReviews?: number; keywordViews?: number; flowEnabled?: number } | null;
  error: string | null;
}

interface ResetsData {
  serverNow: string;
  lastResetAt: string | null;
  nextResetAt: string;
  items: ResetItem[];
}

interface RunResult {
  weekKey: string;
  skipped: boolean;
  dryRun: boolean;
  affectedUsers: number;
  counts: { topicTests: number; randomTests: number; answers: number; aiInsights: number; videoProgress?: number; keywordReviews?: number; keywordViews?: number; flowEnabled?: number };
}

type UserRow = WeekSummary & {
  user: { id: string; firstName: string | null; lastName: string | null; phone: string | null; login: string | null; type: string; weeklyResetExempt: boolean };
};

const STATUS: Record<ResetItem["status"], { label: string; tone: "success" | "danger" | "warning" | "muted" }> = {
  done: { label: "Bajarildi", tone: "success" },
  covered: { label: "Qoplangan", tone: "muted" },
  running: { label: "Bajarilmoqda", tone: "warning" },
  failed: { label: "Xato", tone: "danger" },
};

const TRIGGER: Record<ResetItem["triggeredBy"], string> = {
  cron: "Jadval (cron)",
  catchup: "Kechikkan (catch-up)",
  manual: "Qo'lda",
  initial: "Birinchi (deploy)",
};

const CONFIRM_WORD = "YANGILASH";

/** Haftalik natijalar yangilanishi: tarix, "Hozir yangilash" va hafta bo'yicha natijalar. */
export default function AdminWeeklyResultsPage() {
  const [resets, setResets] = useState<ResetsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [week, setWeek] = useState("current");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<Paged<UserRow> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadResets = useCallback(() => {
    setError(null);
    adminFetch<ResetsData>("weekly-resets")
      .then(setResets)
      .catch((err) => setError(err instanceof Error ? err.message : "Xatolik"));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadResets();
  }, [loadResets]);

  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const loadUsers = useCallback(() => {
    setUsers(null);
    const params = new URLSearchParams({ page: String(page), pageSize: "50", ...(query ? { q: query } : {}) });
    adminFetch<Paged<UserRow>>(`weekly-resets/${encodeURIComponent(week)}/users?${params}`)
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : "Xatolik"));
  }, [week, page, query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers();
  }, [loadUsers]);

  const weeks = resets?.items.filter((r) => r.status === "done") ?? [];

  return (
    <>
      <PageHeader
        title="Haftalik natijalar"
        subtitle="Har dushanba 22:00 (Toshkent) da o'quvchilar test natijalari, video va kalit so'zlar progressi nolga tushadi; eskilari shu yerda arxivda saqlanadi."
        actions={
          <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)} data-testid="weekly-reset-now">
            <RefreshCwIcon className="size-4" />
            Hozir yangilash
          </Button>
        }
      />
      {error && <ErrorBlock message={error} onRetry={loadResets} />}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Oxirgi yangilanish" value={resets ? (resets.lastResetAt ? formatDateTime(resets.lastResetAt) : "—") : "…"} />
        <StatCard label="Keyingi yangilanish" value={resets ? formatDateTime(resets.nextResetAt) : "…"} tone="brand" />
        <StatCard label="Arxivdagi haftalar" value={resets ? weeks.length : "…"} />
      </div>

      <Panel title="Hafta bo'yicha natijalar" className="mb-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Select
            value={week}
            onChange={(e) => {
              setWeek(e.target.value);
              setPage(1);
            }}
            className="sm:max-w-xs"
            name="weekly-week"
            data-testid="weekly-week-select"
          >
            <option value="current">Joriy hafta (hali yangilanmagan)</option>
            {weeks.map((w) => (
              <option key={w.weekKey} value={w.weekKey}>
                {weekLabel(w.weekKey)} · {formatDateTime(w.startedAt)}
              </option>
            ))}
          </Select>
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, familiya yoki telefon" className="sm:max-w-xs" name="weekly-search" />
        </div>
        {!users ? (
          <LoadingBlock />
        ) : users.items.length === 0 ? (
          <EmptyState>Bu hafta natijalar yo&apos;q</EmptyState>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Foydalanuvchi</Th>
                  <Th>Testlar</Th>
                  <Th>O&apos;rtacha</Th>
                  <Th>To&apos;g&apos;ri / xato</Th>
                </tr>
              </thead>
              <tbody>
                {users.items.map((r) => (
                  <tr key={r.user.id} data-testid="weekly-user-row">
                    <Td>
                      <Link href={`/admin/users/${r.user.id}`} className="hover:text-brand">
                        <span className="font-semibold text-foreground">{fullName(r.user)}</span>
                        <span className="block text-xs text-muted-foreground">{r.user.phone ? formatPhone(r.user.phone) : (r.user.login ?? "")}</span>
                      </Link>
                      {r.user.weeklyResetExempt && <Badge tone="warning" className="mt-1">ozod</Badge>}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {r.tests} <span className="text-xs text-muted-foreground">(mavzu {r.topicTests}, random {r.randomTests})</span>
                    </Td>
                    <Td className="font-mono font-semibold">{r.averagePercent === null ? "—" : `${String(r.averagePercent).replace(".", ",")}%`}</Td>
                    <Td className="font-mono whitespace-nowrap">
                      <span className="text-success">{r.correct}</span> / <span className="text-danger">{r.wrong}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={users.page} pageSize={users.pageSize} total={users.total} onPage={setPage} />
          </>
        )}
      </Panel>

      <Panel title="Yangilanishlar tarixi">
        {!resets ? (
          <LoadingBlock />
        ) : resets.items.length === 0 ? (
          <EmptyState>Hali yangilanish bo&apos;lmagan</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Hafta</Th>
                <Th>Turi</Th>
                <Th>Vaqt</Th>
                <Th>Foydalanuvchilar</Th>
                <Th>Arxivlangan</Th>
                <Th>Holat</Th>
              </tr>
            </thead>
            <tbody>
              {resets.items.map((r) => (
                <tr key={r.weekKey} data-testid="weekly-reset-row">
                  <Td className="font-semibold whitespace-nowrap">{weekLabel(r.weekKey)}</Td>
                  <Td className="whitespace-nowrap">{TRIGGER[r.triggeredBy] ?? r.triggeredBy}</Td>
                  <Td className="whitespace-nowrap">{formatDateTime(r.finishedAt ?? r.startedAt)}</Td>
                  <Td className="font-mono">{r.status === "covered" ? "—" : r.affectedUsers}</Td>
                  <Td className="text-xs text-muted-foreground">
                    {r.counts ? `mavzu ${r.counts.topicTests} · random ${r.counts.randomTests} · javob ${r.counts.answers} · video ${r.counts.videoProgress ?? 0} · kalit so'zlar ${(r.counts.keywordReviews ?? 0) + (r.counts.keywordViews ?? 0)}` : "—"}
                  </Td>
                  <Td>
                    <Badge tone={STATUS[r.status]?.tone ?? "muted"}>{STATUS[r.status]?.label ?? r.status}</Badge>
                    {r.error && <span className="mt-1 block max-w-xs text-xs text-danger">{r.error}</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <ResetNowDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDone={() => {
          loadResets();
          loadUsers();
        }}
      />
    </>
  );
}

/** Xavfli amal: avval nechta yozuv ta'sirlanishi ko'rsatiladi, keyin admin "YANGILASH" deb yozadi. */
function ResetNowDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const [word, setWord] = useState("");
  const [preview, setPreview] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWord("");
    setPreview(null);
    adminFetch<RunResult>("weekly-resets/run", { json: { confirm: CONFIRM_WORD, dryRun: true } })
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [open]);

  async function run() {
    setBusy(true);
    try {
      const res = await adminFetch<RunResult>("weekly-resets/run", { json: { confirm: word.trim() } });
      showToast({ tone: "success", message: `Natijalar yangilandi: ${res.affectedUsers} ta foydalanuvchi` });
      onOpenChange(false);
      onDone();
    } catch (err) {
      showToast({ tone: "danger", message: err instanceof Error ? err.message : "Bajarib bo'lmadi" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      icon={<TriangleAlertIcon className="size-5 text-danger" />}
      title="Barcha natijalarni hozir yangilash"
      description="Haftalik yangilanishdan ozod qilinmagan barcha o'quvchilarning natijalari arxivlanib, hozirning o'zida nolga tushadi. Saytdagi o'quvchilarning sahifasi ham yangilanadi."
    >
      <div className="flex flex-col gap-3" data-testid="weekly-reset-dialog">
        <p className="text-sm text-muted-foreground">
          {preview
            ? `Ta'sirlanadi: ${preview.affectedUsers} ta foydalanuvchi — mavzu testlari ${preview.counts.topicTests}, random testlar ${preview.counts.randomTests}, javoblar ${preview.counts.answers}, video progressi ${preview.counts.videoProgress ?? 0}, kalit so'zlar belgilari ${(preview.counts.keywordReviews ?? 0) + (preview.counts.keywordViews ?? 0)}; yangi oqim yoqiladi: ${preview.counts.flowEnabled ?? 0} ta foydalanuvchi.`
            : "Hisoblanmoqda…"}
        </p>
        <label className="text-sm text-foreground">
          Tasdiqlash uchun <b className="font-mono">{CONFIRM_WORD}</b> deb yozing:
          <TextInput value={word} onChange={(e) => setWord(e.target.value)} className="mt-1.5" autoComplete="off" name="weekly-confirm" data-testid="weekly-confirm-input" />
        </label>
        <div className="flex gap-2">
          <Button variant="danger" size="sm" disabled={busy || word.trim() !== CONFIRM_WORD} onClick={run} data-testid="weekly-confirm-run">
            Hozir yangilash
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
