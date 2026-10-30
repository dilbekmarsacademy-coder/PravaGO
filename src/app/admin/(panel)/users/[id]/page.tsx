"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, MonitorIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { formatDate, formatDateTime, formatPhone, formatRelative, formatSom } from "@/lib/admin/format";
import { EXAM_STATUS_LABEL, fullName, type AdminPayment, type UserPaymentStatus, type UserProgress } from "@/lib/admin/types";
import { Badge } from "@/components/shared/Badge";
import { showToast } from "@/components/shared/Toast";
import DeleteButton from "@/components/admin/DeleteButton";
import AddPaymentForm from "@/components/admin/AddPaymentForm";
import PaymentActions from "@/components/admin/PaymentActions";
import { PaymentBadge, ProgressBar, UserPaymentBadge } from "@/components/admin/StatusBadges";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Panel, StatCard, Table, Td, Th } from "@/components/admin/ui";

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
}

interface UserDetail {
  id: string;
  type?: "SELF" | "CENTER";
  login?: string | null;
  isActive?: boolean;
  centerAccess?: boolean;
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
        <Panel title={`Qurilmalar (${data.devices.length})`}>
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
                      <Td className="font-mono text-xs">
                        {t.keywordsReviewed} / {t.questionCount}
                      </Td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          </div>
        ))}
      </Panel>

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
