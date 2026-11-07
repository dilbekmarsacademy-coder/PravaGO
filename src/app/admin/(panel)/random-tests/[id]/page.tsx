"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { formatClock, formatDateTime, formatPhone } from "@/lib/admin/format";
import { fullName } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/shared/Badge";
import { RANDOM_STATUS, type AdminRandomTestRow } from "@/components/admin/RandomTestsTable";
import { ErrorBlock, LoadingBlock, PageHeader, Panel, StatCard, Table, Tabs, Td, Th } from "@/components/admin/ui";

type ItemResult = "correct" | "wrong" | "unanswered" | "pending";

interface Detail extends Required<AdminRandomTestRow> {
  items: {
    position: number;
    questionId: string;
    topicSlug: string;
    topicTitle: string;
    order: number;
    text: string;
    selected: string | null;
    correctAnswer: string | null;
    result: ItemResult;
    keyword: string | null;
    answeredAt: string | null;
  }[];
}

const RESULT: Record<ItemResult, { label: string; tone: "success" | "danger" | "muted" | "warning" }> = {
  correct: { label: "To'g'ri", tone: "success" },
  wrong: { label: "Xato", tone: "danger" },
  unanswered: { label: "Javobsiz", tone: "muted" },
  pending: { label: "Hali javob yo'q", tone: "warning" },
};

/** Bitta random test urinishi — savollar kesimida. */
export default function AdminRandomTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "wrong">("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await adminFetch(`random-tests/${id}`));
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
  const items = filter === "wrong" ? data.items.filter((i) => i.result === "wrong" || i.result === "unanswered") : data.items;

  return (
    <>
      <Link href={`/admin/users/${data.user.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeftIcon className="size-4" /> {fullName(data.user)}
      </Link>
      <PageHeader
        title={`Random test · ${data.size} ta savol`}
        subtitle={
          <span>
            {fullName(data.user)} · {data.user.login ?? formatPhone(data.user.phone)} · {formatDateTime(data.startedAt)}{" "}
            <Badge tone={RANDOM_STATUS[data.status].tone}>{RANDOM_STATUS[data.status].label}</Badge>
          </span>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Foiz" value={`${data.percent}%`} tone="brand" />
        <StatCard label="To'g'ri" value={data.correct} tone="success" />
        <StatCard label="Xato" value={data.wrong} />
        <StatCard label="Javobsiz" value={data.unanswered} />
        <StatCard label="Sarflangan vaqt" value={formatClock(data.durationSec)} />
      </div>
      <Tabs
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: `Hammasi (${data.items.length})` },
          { value: "wrong", label: `Xato va javobsiz (${data.wrong + data.unanswered})` },
        ]}
      />
      <Panel>
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Mavzu</Th>
              <Th>Savol</Th>
              <Th>Foydalanuvchi javobi</Th>
              <Th>To&apos;g&apos;ri javob</Th>
              <Th>Kalit so&apos;z</Th>
              <Th>Natija</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.position} data-testid="admin-random-item">
                <Td className="font-mono text-xs">{i.position + 1}</Td>
                <Td className="text-xs">
                  <span className="font-mono text-muted-foreground">{i.topicSlug}</span>
                  <span className="block">{i.topicTitle !== i.topicSlug ? i.topicTitle : ""}</span>
                </Td>
                <Td className="max-w-80">
                  <Link href={`/admin/questions/${i.questionId}`} className="hover:text-brand">
                    <span className="font-mono text-xs text-muted-foreground">#{i.order}</span> {i.text}
                  </Link>
                </Td>
                <Td className={cn("max-w-56 text-sm", i.result === "correct" ? "text-success" : i.result === "wrong" ? "text-danger" : "text-muted-foreground")}>
                  {i.selected ?? "—"}
                </Td>
                <Td className="max-w-56 text-sm">{i.correctAnswer ?? "—"}</Td>
                <Td className="max-w-48 text-xs font-semibold">{i.keyword ?? "—"}</Td>
                <Td>
                  <Badge tone={RESULT[i.result].tone}>{RESULT[i.result].label}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
