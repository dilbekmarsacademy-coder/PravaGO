"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, MonitorIcon, RotateCcwIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { formatDate, formatDateTime, formatPhone, formatRelative, formatSom } from "@/lib/admin/format";
import { EXAM_STATUS_LABEL, fullName, type AdminPayment, type UserPaymentStatus, type UserProgress } from "@/lib/admin/types";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { showToast } from "@/components/shared/Toast";
import DeleteButton from "@/components/admin/DeleteButton";
import AddPaymentForm from "@/components/admin/AddPaymentForm";
import PaymentActions from "@/components/admin/PaymentActions";
import { PaymentBadge, ProgressBar, UserPaymentBadge } from "@/components/admin/StatusBadges";
import RandomTestsTable, { type AdminRandomTestRow } from "@/components/admin/RandomTestsTable";
import { UserFinalExamPanel } from "@/components/admin/FinalExamPanel";
import { UserWeeklyResultsPanel } from "@/components/admin/WeeklyResults";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Panel, StatCard, Table, Td, TextInput, Th } from "@/components/admin/ui";

interface TopicResult {
  slug: string;
  day: number;
  order: number;
  title: string;
  questionCount: number;
  attempts: number;
  bestPercent: number | null;
  lastPercent: number | null;
  lastAttemptAt: string | null;
  passed: boolean;
  videoWatched: boolean | null;
  keywordsReviewed: number;
  /** "Tanishib chiqdim" bosilgan (yangi oqim). */
  keywordsViewed?: boolean;
}

interface UserDetail {
  id: string;
  type?: "SELF" | "CENTER";
  login?: string | null;
  isActive?: boolean;
  centerAccess?: boolean;
  /** Hamma narsa ochiq: kun/mavzu qulfi, video va kalit so'z sharti yo'q. */
  unlockAll?: boolean;
  /** Yangi oqim (video → kalit so'zlar → test) majburiy. */
  topicFlowGatingEnabled?: boolean;
  weeklyResetExempt?: boolean;
  progressResetAt?: string | null;
  lastLoginAt?: string | null;
  lastDevice?: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  age: number | null;
  examStatus: string | null;
  preferredLanguage: string | null;
  registeredAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  paymentStatus: UserPaymentStatus;
  accessGrantedAt: string | null;
  progress: UserProgress;
  devices: { id: string; type: "mobile" | "tablet" | "desktop"; label: string; createdAt: string; lastSeenAt: string | null; expired: boolean }[];
  payments: AdminPayment[];
  topics: TopicResult[];
  mostWrong: { questionId: string; order: number; topicSlug: string; topicTitle: string; text: string; wrongCount: number }[];
}

const LANG: Record<string, string> = { "uz-latn": "O'zbek (lotin)", "uz-cyrl": "O'zbek (kirill)", ru: "Rus" };
const DEVICE_ICON = { mobile: SmartphoneIcon, tablet: TabletIcon, desktop: MonitorIcon };

export default function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await adminFetch<UserDetail>(`users/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!data) return <LoadingBlock />;

  async function remove() {
    await adminFetch(`users/${id}`, { method: "DELETE" });
    showToast({ message: "Foydalanuvchi o'chirildi", tone: "success" });
    router.push("/admin/users");
  }

  const days = [...new Set(data.topics.map((t) => t.day))];

  return (
    <>
      <Link href={data.type === "SELF" ? "/admin/users?tab=self" : "/admin/users"} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeftIcon className="size-4" /> Foydalanuvchilar
      </Link>
      <PageHeader title={fullName(data)} subtitle={<span className="font-mono">{formatPhone(data.phone)}</span>} actions={
          <>
            {data.type === "CENTER" ? <Badge tone="brand">markaz o&apos;quvchisi</Badge> : <UserPaymentBadge status={data.paymentStatus} />}
            <DeleteButton label="Foydalanuvchini o'chirish" confirmLabel="Ha, butunlay o'chirish" onDelete={remove} testId="user-delete" />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Umumiy progress" value={`${data.progress.percent}%`} hint={`${data.progress.passedTopics} / ${data.progress.totalTopics} mavzu`} tone="brand" />
        <StatCard label="O'tilgan kunlar" value={data.progress.passedDays.length || "0"} hint={data.progress.passedDays.length ? data.progress.passedDays.map((d) => `${d}-kun`).join(", ") : "—"} />
        <StatCard label="Ro'yxatdan o'tgan" value={formatDate(data.registeredAt)} />
        <StatCard label="Oxirgi faollik" value={formatRelative(data.lastActiveAt)} hint={formatDateTime(data.lastActiveAt)} />
      </div>

      <UnlockAllPanel userId={data.id} enabled={Boolean(data.unlockAll)} onChange={(unlockAll) => setData((d) => (d ? { ...d, unlockAll } : d))} />
      <ProgressResetPanel user={data} onDone={load} />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Shaxsiy ma'lumot">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Turi</dt>
            <dd>{data.type === "CENTER" ? "Shu yerda o'qiydi (markaz o'quvchisi)" : "Yangi foydalanuvchi (o'zi ro'yxatdan o'tgan)"}</dd>
            {data.type === "CENTER" && (
              <>
                <dt className="text-muted-foreground">Login</dt>
                <dd className="font-mono">{data.login}</dd>
                <dt className="text-muted-foreground">Holat</dt>
                <dd>
                  {data.isActive ? "faol" : "faolsiz"} · kirish {data.centerAccess ? "to'liq" : "o'chirilgan"}
                </dd>
                <dt className="text-muted-foreground">Oxirgi kirish</dt>
                <dd>
                  {formatDateTime(data.lastLoginAt)}
                  {data.lastDevice ? ` · ${data.lastDevice}` : ""}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Ism, familiya</dt>
            <dd>{fullName(data)}</dd>
            <dt className="text-muted-foreground">Telefon</dt>
            <dd className="font-mono">{formatPhone(data.phone)}</dd>
            <dt className="text-muted-foreground">Yosh</dt>
            <dd>{data.age ?? "—"}</dd>
            <dt className="text-muted-foreground">Toifa</dt>
            <dd>{data.examStatus ? EXAM_STATUS_LABEL[data.examStatus] ?? data.examStatus : "—"}</dd>
            <dt className="text-muted-foreground">Til</dt>
            <dd>{data.preferredLanguage ? LANG[data.preferredLanguage] ?? data.preferredLanguage : "—"}</dd>
            <dt className="text-muted-foreground">Kurs ochilgan</dt>
            <dd>{formatDateTime(data.accessGrantedAt)}</dd>
          </dl>
        </Panel>
        <Panel title="Oxirgi kirgan qurilmalar">
          {data.devices.length === 0 ? (
            <EmptyState>Qurilma yo&apos;q</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.devices.map((d) => {
                const Icon = DEVICE_ICON[d.type];
                return (
                  <li key={d.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm">
                    <Icon className="size-4.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{d.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Birinchi: {formatDate(d.createdAt)} · oxirgi: {formatRelative(d.lastSeenAt)}
                      </p>
                    </div>
                    {d.expired && <Badge tone="muted">Muddati o&apos;tgan</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="To'lovlar tarixi" className="mb-6">
        {data.payments.length === 0 ? (
          <p className="mb-4 text-sm text-muted-foreground">To&apos;lov yo&apos;q</p>
        ) : (
          <Table className="mb-4">
            <thead>
              <tr>
                <Th>Sana</Th>
                <Th>Summa</Th>
                <Th>Holat</Th>
                <Th>Izoh</Th>
                <Th>Kim tasdiqladi</Th>
                <Th>Amal</Th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(p.createdAt)}</Td>
                  <Td className="font-mono">{formatSom(p.amount)}</Td>
                  <Td>
                    <PaymentBadge status={p.status} />
                  </Td>
                  <Td className="max-w-56 text-xs">
                    {p.userNote && <span className="block">Foydalanuvchi: {p.userNote}</span>}
                    {p.note && <span className="block text-muted-foreground">Admin: {p.note}</span>}
                  </Td>
                  <Td className="text-xs">{p.confirmedBy ? `${p.confirmedBy.login}, ${formatDateTime(p.confirmedAt)}` : "—"}</Td>
                  <Td>
                    <PaymentActions payment={p} onDone={load} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-brand">Qo&apos;lda to&apos;lov qo&apos;shish</summary>
          <div className="mt-3">
            <AddPaymentForm userId={data.id} onDone={load} />
          </div>
        </details>
      </Panel>

      <Panel title="Natijalar (kun va mavzu bo'yicha)" className="mb-6">
        {days.map((day) => (
          <div key={day} className="mb-5 last:mb-0">
            <h3 className="mb-2 font-mono text-xs font-bold tracking-wide text-muted-foreground uppercase">
              {day}-kun {data.progress.passedDays.includes(day) && <Badge tone="success">o&apos;tilgan</Badge>}
            </h3>
            <Table>
              <thead>
                <tr>
                  <Th>Mavzu</Th>
                  <Th>Video</Th>
                  <Th>Urinishlar</Th>
                  <Th>Eng yaxshi</Th>
                  <Th>98% o&apos;tdimi</Th>
                  <Th>Oxirgi urinish</Th>
                  <Th>Kalit so&apos;zlar</Th>
                </tr>
              </thead>
              <tbody>
                {data.topics
                  .filter((t) => t.day === day)
                  .map((t) => (
                    <tr key={t.slug}>
                      <Td>
                        <span className="font-mono text-xs text-muted-foreground">{t.order}.</span> {t.title !== t.slug ? t.title : t.slug}
                      </Td>
                      <Td>{t.videoWatched === null ? "—" : t.videoWatched ? <Badge tone="success">ko&apos;rilgan</Badge> : <Badge tone="muted">yo&apos;q</Badge>}</Td>
                      <Td className="font-mono">{t.attempts}</Td>
                      <Td>{t.bestPercent === null ? "—" : <ProgressBar percent={t.bestPercent} />}</Td>
                      <Td>{t.attempts === 0 ? "—" : t.passed ? <Badge tone="success">ha</Badge> : <Badge tone="danger">yo&apos;q</Badge>}</Td>
                      <Td className="text-xs whitespace-nowrap">
                        {t.lastAttemptAt ? `${t.lastPercent}% · ${formatDateTime(t.lastAttemptAt)}` : "—"}
                      </Td>
                      <Td className="font-mono text-xs whitespace-nowrap">
                        {t.keywordsReviewed} / {t.questionCount}
                        {t.keywordsViewed && (
                          <Badge tone="success" className="ml-1.5">
                            tanishib chiqdi
                          </Badge>
                        )}
                      </Td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          </div>
        ))}
      </Panel>

      <UserRandomTests userId={data.id} />

      <UserFinalExamPanel userId={data.id} />

      {/* Nollashdan keyin arxiv qayta yuklanadi. */}
      <UserWeeklyResultsPanel key={data.progressResetAt ?? "none"} userId={data.id} />

      <Panel title="Eng ko'p xato qilgan savollari">
        {data.mostWrong.length === 0 ? (
          <EmptyState>Xato javoblar yo&apos;q</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.mostWrong.map((q) => (
              <li key={q.questionId} className="flex items-start gap-3 rounded-xl border border-border px-3 py-2 text-sm">
                <span className="mt-0.5 rounded-full bg-danger/15 px-2 py-0.5 font-mono text-xs font-bold text-danger">{q.wrongCount}×</span>
                <div className="min-w-0">
                  <p className="line-clamp-2">{q.text}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {q.topicSlug} · #{q.order}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

/** Foydalanuvchining random test urinishlari (oxirgi 50 tasi). */
function UserRandomTests({ userId }: { userId: string }) {
  const [rows, setRows] = useState<{ total: number; items: AdminRandomTestRow[] } | null>(null);
  useEffect(() => {
    adminFetch<{ total: number; items: AdminRandomTestRow[] }>(`random-tests?userId=${userId}&pageSize=50`)
      .then(setRows)
      .catch(() => setRows({ total: 0, items: [] }));
  }, [userId]);
  return (
    <Panel title={`Random testlar${rows ? ` (${rows.total})` : ""}`} className="mb-6">
      {!rows ? (
        <LoadingBlock />
      ) : rows.items.length === 0 ? (
        <EmptyState>Hali random test yechmagan</EmptyState>
      ) : (
        <div data-testid="user-random-tests">
          <RandomTestsTable items={rows.items} />
          {rows.total > rows.items.length && (
            <Link href={`/admin/random-tests?userId=${userId}`} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
              Hammasi ({rows.total})
            </Link>
          )}
        </div>
      )}
    </Panel>
  );
}

/**
 * Shu o'quvchiga hamma narsani ochish: barcha kun va mavzular, test videoni
 * ko'rmasdan va kalit so'zlar bilan tanishmasdan. Faqat shu foydalanuvchi uchun.
 */
function UnlockAllPanel({ userId, enabled, onChange }: { userId: string; enabled: boolean; onChange: (enabled: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      const res = await adminFetch<{ unlockAll: boolean }>(`users/${userId}/unlock-all`, { json: { enabled: !enabled } });
      onChange(res.unlockAll);
      showToast({ tone: "success", message: res.unlockAll ? "Hamma narsa ochildi — o'quvchi sahifani yangilashi kerak" : "Odatiy tartib qaytarildi" });
    } catch (err) {
      showToast({ tone: "danger", message: err instanceof Error ? err.message : "Bajarib bo'lmadi" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-testid="unlock-all-panel">
        <div>
          <p className="flex items-center gap-2 font-semibold text-foreground">
            Hamma narsa ochiq {enabled ? <Badge tone="success">yoqilgan</Badge> : <Badge tone="muted">o&apos;chiq</Badge>}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Barcha kun va mavzular ochiladi; test videoni ko&apos;rmasdan va kalit so&apos;zlar bilan tanishmasdan yechiladi. Faqat shu o&apos;quvchiga.
          </p>
        </div>
        <Button variant={enabled ? "secondary" : "primary"} size="sm" disabled={busy} onClick={toggle} data-testid="unlock-all-toggle">
          {enabled ? "O'chirish" : "Hammasini ochish"}
        </Button>
      </div>
    </Panel>
  );
}

interface ResetPreview {
  affectedUsers: number;
  counts: { topicTests: number; randomTests: number; answers: number; videoProgress: number; keywordReviews: number; keywordViews: number };
}

/**
 * "Progressni to'liq nolga tushirish": shu o'quvchining test natijalari, video va
 * kalit so'zlar progressi arxivlanib nollanadi va yangi oqim (video → kalit
 * so'zlar → test) yoqiladi. Admin "NOLLASH" so'zini yozsagina ishlaydi. Yakuniy
 * imtihon, sertifikat, to'lov va profilga tegilmaydi. Natijalar arxivda qoladi.
 */
function ProgressResetPanel({ user, onDone }: { user: UserDetail; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ResetPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openDialog() {
    setOpen(true);
    setConfirm("");
    setError(null);
    setPreview(null);
    try {
      setPreview(await adminFetch<ResetPreview>(`users/${user.id}/progress-reset`, { json: { confirm: "NOLLASH", dryRun: true } }));
    } catch {
      // Oldindan ko'rish bo'lmasa ham nollash mumkin.
    }
  }

  async function run() {
    if (busy || confirm !== "NOLLASH") return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`users/${user.id}/progress-reset`, { json: { confirm } });
      setOpen(false);
      showToast({ tone: "success", message: "Progress nolga tushirildi — o'quvchi hammasini qaytadan ko'radi" });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bajarib bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-testid="progress-reset-panel">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            Mavzu oqimi: video → kalit so&apos;zlar → test{" "}
            {user.topicFlowGatingEnabled ? <Badge tone="success">majburiy</Badge> : <Badge tone="muted">eski tartib</Badge>}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nollash: test natijalari, video va kalit so&apos;zlar progressi arxivlanib nolga tushadi, yangi oqim yoqiladi. Yakuniy imtihon, sertifikat va to&apos;lovlar saqlanadi.
            {user.progressResetAt && ` Oxirgi nollash: ${formatDateTime(user.progressResetAt)}.`}
          </p>
        </div>
        <Button variant="danger" size="sm" onClick={openDialog} data-testid="progress-reset-open">
          <RotateCcwIcon className="size-4" /> Progressni to&apos;liq nolga tushirish
        </Button>
      </div>
      <Modal
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        title="Progressni to'liq nolga tushirish"
        description={`${fullName(user)} — barcha test natijalari, video va kalit so'zlar progressi arxivlanib nolga tushadi. Tasdiqlash uchun NOLLASH deb yozing.`}
      >
        {preview && (
          <p className="mb-3 rounded-xl bg-surface px-3 py-2 text-sm text-muted-foreground" data-testid="progress-reset-preview">
            Mavzu testlari {preview.counts.topicTests}, random testlar {preview.counts.randomTests}, javoblar {preview.counts.answers}, video {preview.counts.videoProgress}, kalit so&apos;zlar belgilari{" "}
            {preview.counts.keywordReviews + preview.counts.keywordViews}.
          </p>
        )}
        <TextInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="NOLLASH" autoComplete="off" aria-label="Tasdiqlash so'zi" data-testid="progress-reset-input" />
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
            Bekor qilish
          </Button>
          <Button variant="danger" className="bg-danger/10 font-bold" onClick={run} disabled={busy || confirm !== "NOLLASH"} data-testid="progress-reset-confirm">
            {busy ? "Nollanmoqda…" : "Nolga tushirish"}
          </Button>
        </div>
      </Modal>
    </Panel>
  );
}
