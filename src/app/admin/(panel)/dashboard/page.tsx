"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/api";
import { formatDuration, formatNumber } from "@/lib/admin/format";
import { BarChart, HBars } from "@/components/admin/charts";
import { ErrorBlock, LoadingBlock, PageHeader, Panel, StatCard, Table, Tabs, Td, Th } from "@/components/admin/ui";

type Range = "today" | "7d" | "30d";

interface Dashboard {
  active: { dau: number; wau: number; mau: number };
  registrations: { inRange: number; total: number };
  userTypes?: { self: { inRange: number; total: number }; center: { addedInRange: number; total: number; loggedInRange: number } };
  payments: { confirmedInRange: number; paidUsersTotal: number; pending: number };
  conversion: { registeredInRange: number; paidOfThem: number; percent: number };
  sessions: { count: number; avgSec: number };
  series: { bucket: "hour" | "day"; visitors: { t: string; visitors: number; views: number }[]; registrations: { t: string; count: number }[] };
  devices: { device: string; visitors: number }[];
  mostSolved: { slug: string; title: string; attempts: number; avgPercent: number; passRate: number }[];
  abandoned: { slug: string; title: string; started: number; finished: number; abandoned: number }[];
  topWrong: { questionId: string; topicSlug: string; order: number; text: string; answers: number; wrong: number; wrongRate: number }[];
  funnel: {
    registered: number;
    registeredByType?: { self: number; center: number };
    days: { day: number; started: number; completed: number; center?: { started: number; completed: number }; self?: { started: number; completed: number } }[];
  };
}

const DEVICE: Record<string, string> = { mobile: "Telefon", tablet: "Planshet", desktop: "Kompyuter" };

function bucketLabel(t: string, bucket: "hour" | "day"): string {
  const d = new Date(t);
  return bucket === "hour" ? `${String(d.getUTCHours()).padStart(2, "0")}:00` : `${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function AdminDashboardPage() {
  const [range, setRange] = useState<Range>("7d");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await adminFetch<Dashboard>(`stats/dashboard?range=${range}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }, [range]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Statistika"
        subtitle="O'zimizning hodisalar jadvali asosida (tashqi analitikasiz)"
        actions={
          <Tabs
            value={range}
            onChange={setRange}
            options={[
              { value: "today", label: "Bugun" },
              { value: "7d", label: "7 kun" },
              { value: "30d", label: "30 kun" },
            ]}
          />
        }
      />
      {error && <ErrorBlock message={error} onRetry={load} />}
      {!data ? (
        <LoadingBlock />
      ) : (
        <div className="flex flex-col gap-6" data-testid="dashboard">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="DAU" value={formatNumber(data.active.dau)} hint="oxirgi 24 soat" tone="brand" />
            <StatCard label="WAU" value={formatNumber(data.active.wau)} hint="oxirgi 7 kun" />
            <StatCard label="MAU" value={formatNumber(data.active.mau)} hint="oxirgi 30 kun" />
            <StatCard
              label="Yangi ro'yxat"
              value={formatNumber(data.userTypes?.self.inRange ?? data.registrations.inRange)}
              hint={`yangi foydalanuvchilar · jami ${formatNumber(data.userTypes?.self.total ?? data.registrations.total)}`}
            />
            <StatCard
              label="To'lov qilganlar"
              value={formatNumber(data.payments.confirmedInRange)}
              hint={`konversiya ${data.conversion.percent}% · kutilmoqda ${data.payments.pending}`}
              tone="success"
            />
            <StatCard label="O'rtacha sessiya" value={formatDuration(data.sessions.avgSec)} hint={`${formatNumber(data.sessions.count)} sessiya`} />
          </div>

          {data.userTypes && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="user-types">
              <StatCard label="Jami foydalanuvchilar" value={formatNumber(data.userTypes.self.total + data.userTypes.center.total)} hint="markaz o'quvchilari + yangi foydalanuvchilar" />
              <StatCard
                label="Markaz o'quvchilari"
                value={formatNumber(data.userTypes.center.total)}
                hint={`davrda qo'shilgan ${formatNumber(data.userTypes.center.addedInRange)} · kirgan ${formatNumber(data.userTypes.center.loggedInRange)}`}
                tone="brand"
              />
              <StatCard label="Yangi foydalanuvchilar" value={formatNumber(data.userTypes.self.total)} hint={`davrda ro'yxatdan o'tgan ${formatNumber(data.userTypes.self.inRange)}`} />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Tashrifchilar">
              <BarChart
                label="Tashrifchilar soni"
                data={data.series.visitors.map((s) => ({ key: s.t, label: bucketLabel(s.t, data.series.bucket), value: s.visitors }))}
              />
            </Panel>
            <Panel title="Ro'yxatdan o'tganlar">
              <BarChart
                label="Ro'yxatdan o'tganlar soni"
                data={data.series.registrations.map((s) => ({ key: s.t, label: bucketLabel(s.t, data.series.bucket), value: s.count }))}
              />
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              title={`Kunlar bo'yicha voronka (jami: ${data.funnel.registered}${data.funnel.registeredByType ? ` · markaz ${data.funnel.registeredByType.center} · yangi ${data.funnel.registeredByType.self}` : ""})`}
            >
              <HBars
                rows={data.funnel.days.flatMap((d) => [
                  { label: `${d.day}-kun boshlagan${d.center ? ` (markaz ${d.center.started} · yangi ${d.self?.started ?? 0})` : ""}`, value: d.started },
                  { label: `${d.day}-kun tugatgan${d.center ? ` (markaz ${d.center.completed} · yangi ${d.self?.completed ?? 0})` : ""}`, value: d.completed },
                ])}
              />
            </Panel>
            <Panel title="Qurilma turi">
              <HBars rows={data.devices.map((d) => ({ label: DEVICE[d.device] ?? d.device, value: d.visitors }))} />
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Eng ko'p yechilgan mavzular">
              <HBars rows={data.mostSolved.map((t) => ({ label: t.title && t.title !== t.slug ? t.title : t.slug, value: t.attempts, hint: `o'rtacha ${t.avgPercent}%, o'tish ${t.passRate}%` }))} />
            </Panel>
            <Panel title="Tashlab ketilgan testlar (boshlangan − tugatilgan)">
              <HBars rows={data.abandoned.map((t) => ({ label: t.title && t.title !== t.slug ? t.title : t.slug, value: t.abandoned, hint: `${t.started} boshlangan, ${t.finished} tugatilgan` }))} />
            </Panel>
          </div>

          <Panel title="Eng ko'p xato qilinadigan 20 savol">
            {data.topWrong.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Ma&apos;lumot yo&apos;q</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Savol</Th>
                    <Th>Mavzu</Th>
                    <Th>Javoblar</Th>
                    <Th>Xato</Th>
                    <Th>Xato %</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.topWrong.map((q) => (
                    <tr key={q.questionId}>
                      <Td className="max-w-md">
                        <span className="line-clamp-2">{q.text}</span>
                      </Td>
                      <Td className="font-mono text-xs whitespace-nowrap">
                        {q.topicSlug} #{q.order}
                      </Td>
                      <Td className="font-mono">{q.answers}</Td>
                      <Td className="font-mono">{q.wrong}</Td>
                      <Td className="font-mono">{q.wrongRate}%</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
