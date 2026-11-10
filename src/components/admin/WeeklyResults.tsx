"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { formatDate, formatDateTime } from "@/lib/admin/format";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { EmptyState, LoadingBlock, Panel, Table, Td, Th } from "@/components/admin/ui";

// Haftalik natijalar yangilanishi — admin ko'rinishlari. Arxiv faqat o'qish uchun.

export interface WeekSummary {
  weekKey: string;
  from: string | null;
  to: string | null;
  topicTests: number;
  randomTests: number;
  tests: number;
  averagePercent: number | null;
  correct: number;
  wrong: number;
}

interface UserWeeks {
  exempt: boolean;
  current: WeekSummary;
  weeks: WeekSummary[];
}

interface WeekDetail {
  weekKey: string;
  topicTests: { id: string; topicSlug: string; topicTitle: string; correct: number; total: number; percent: number; createdAt: string }[];
  randomTests: { id: string; size: number; total: number; answered: number; correct: number; percent: number; status: string; startedAt: string; finishedAt: string | null }[];
}

/** "2026-W46" | "initial-launch" | "manual-2026-11-10T09:00:00" → o'qiladigan nom. */
export function weekLabel(weekKey: string): string {
  if (weekKey === "current") return "Joriy hafta";
  if (weekKey === "initial-launch") return "Birinchi yangilanish";
  if (weekKey.startsWith("manual-")) return `Qo'lda · ${formatDateTime(`${weekKey.slice(7)}Z`)}`;
  return weekKey;
}

export function rangeLabel(w: Pick<WeekSummary, "from" | "to">): string {
  if (!w.from && !w.to) return "—";
  return `${w.from ? formatDate(w.from) : "boshidan"} — ${w.to ? formatDate(w.to) : "hozir"}`;
}

const percent = (n: number | null) => (n === null ? "—" : `${String(n).replace(".", ",")}%`);

/** Foydalanuvchi sahifasi: haftalik yangilanishdan ozod qilish (tumbler) va natijalar arxivi. */
export function UserWeeklyResultsPanel({ userId }: { userId: string }) {
  const [data, setData] = useState<UserWeeks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminFetch<UserWeeks>(`users/${userId}/results-archive`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Yuklab bo'lmadi"));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleExempt() {
    if (!data) return;
    setBusy(true);
    try {
      const res = await adminFetch<{ weeklyResetExempt: boolean }>(`users/${userId}/weekly-reset-exempt`, { json: { enabled: !data.exempt } });
      setData({ ...data, exempt: res.weeklyResetExempt });
      showToast({ tone: "success", message: res.weeklyResetExempt ? "Haftalik yangilanish bu akkauntga tegmaydi" : "Haftalik yangilanish yana qo'llanadi" });
    } catch (err) {
      showToast({ tone: "danger", message: err instanceof Error ? err.message : "Bajarib bo'lmadi" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Natijalar arxivi (haftalar bo'yicha)" className="mb-6">
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !data ? (
        <LoadingBlock />
      ) : (
        <div className="flex flex-col gap-4" data-testid="weekly-archive">
          <div className="flex flex-col gap-3 rounded-2xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-semibold text-foreground">
                Haftalik yangilanishdan ozod {data.exempt ? <Badge tone="warning">yoqilgan</Badge> : <Badge tone="muted">o&apos;chiq</Badge>}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Yoqilsa, har dushanba 22:00 dagi yangilanishda bu o&apos;quvchining natijalari nolga tushmaydi va arxivlanmaydi.
              </p>
            </div>
            <Button variant={data.exempt ? "secondary" : "primary"} size="sm" disabled={busy} onClick={toggleExempt} data-testid="weekly-exempt-toggle">
              {data.exempt ? "O'chirish" : "Yoqish"}
            </Button>
          </div>

          <Table>
            <thead>
              <tr>
                <Th>Hafta</Th>
                <Th>Oraliq</Th>
                <Th>Testlar</Th>
                <Th>O&apos;rtacha</Th>
                <Th>To&apos;g&apos;ri / xato</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {[data.current, ...data.weeks].map((w) => (
                <Fragment key={w.weekKey}>
                  <tr data-testid="archive-week-row">
                    <Td className="font-semibold whitespace-nowrap">
                      {weekLabel(w.weekKey)}
                      {w.weekKey === "current" && <Badge tone="brand" className="ml-2">hozirgi</Badge>}
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{rangeLabel(w)}</Td>
                    <Td className="whitespace-nowrap">
                      {w.tests} <span className="text-xs text-muted-foreground">(mavzu {w.topicTests}, random {w.randomTests})</span>
                    </Td>
                    <Td className="font-mono font-semibold">{percent(w.averagePercent)}</Td>
                    <Td className="font-mono whitespace-nowrap">
                      <span className="text-success">{w.correct}</span> / <span className="text-danger">{w.wrong}</span>
                    </Td>
                    <Td>
                      {w.tests > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setOpen(open === w.weekKey ? null : w.weekKey)} data-testid="archive-week-open">
                          Batafsil
                          {open === w.weekKey ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
                        </Button>
                      )}
                    </Td>
                  </tr>
                  {open === w.weekKey && (
                    <tr>
                      <td colSpan={6} className="bg-surface/60 px-3 py-3">
                        <WeekDetailView userId={userId} weekKey={w.weekKey} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </Table>
          {data.weeks.length === 0 && <EmptyState>Arxivda hali hafta yo&apos;q</EmptyState>}
        </div>
      )}
    </Panel>
  );
}

function WeekDetailView({ userId, weekKey }: { userId: string; weekKey: string }) {
  const [data, setData] = useState<WeekDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<WeekDetail>(`users/${userId}/results-archive/${encodeURIComponent(weekKey)}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Yuklab bo'lmadi"));
  }, [userId, weekKey]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return <LoadingBlock />;
  return (
    <div className="flex flex-col gap-4" data-testid="archive-week-detail">
      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Kunlik (mavzu) testlar · {data.topicTests.length}</p>
        {data.topicTests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Yo&apos;q</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Sana</Th>
                <Th>Mavzu</Th>
                <Th>To&apos;g&apos;ri</Th>
                <Th>Foiz</Th>
              </tr>
            </thead>
            <tbody>
              {data.topicTests.map((t) => (
                <tr key={t.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(t.createdAt)}</Td>
                  <Td>{t.topicTitle}</Td>
                  <Td className="font-mono">
                    {t.correct}/{t.total}
                  </Td>
                  <Td className="font-mono font-semibold">{t.percent}%</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Random testlar · {data.randomTests.length}</p>
        {data.randomTests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Yo&apos;q</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Sana</Th>
                <Th>Savollar</Th>
                <Th>To&apos;g&apos;ri</Th>
                <Th>Foiz</Th>
              </tr>
            </thead>
            <tbody>
              {data.randomTests.map((t) => (
                <tr key={t.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(t.startedAt)}</Td>
                  <Td className="font-mono">{t.total}</Td>
                  <Td className="font-mono">
                    {t.correct}/{t.total} <span className="text-xs text-muted-foreground">({t.answered} javob)</span>
                  </Td>
                  <Td className="font-mono font-semibold">{t.percent}%</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
