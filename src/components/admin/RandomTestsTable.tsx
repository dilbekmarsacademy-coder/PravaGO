"use client";

import Link from "next/link";
import { formatClock, formatDateTime, formatPhone } from "@/lib/admin/format";
import { fullName } from "@/lib/admin/types";
import { Badge } from "@/components/shared/Badge";
import { ProgressBar } from "@/components/admin/StatusBadges";
import { Table, Td, Th } from "@/components/admin/ui";

export type RandomTestStatus = "in_progress" | "finished" | "expired";

export interface AdminRandomTestRow {
  id: string;
  size: number;
  total: number;
  status: RandomTestStatus;
  startedAt: string;
  finishedAt: string | null;
  correct: number;
  wrong: number;
  unanswered: number;
  percent: number;
  durationSec: number;
  user?: { id: string; firstName: string | null; lastName: string | null; phone: string | null; login: string | null; type: string };
}

export const RANDOM_STATUS: Record<RandomTestStatus, { label: string; tone: "success" | "danger" | "warning" }> = {
  finished: { label: "Tugallangan", tone: "success" },
  expired: { label: "Vaqt tugagan", tone: "danger" },
  in_progress: { label: "Tugallanmagan", tone: "warning" },
};

/** Random test urinishlari jadvali (foydalanuvchi sahifasi va umumiy ro'yxat). */
export default function RandomTestsTable({ items, showUser }: { items: AdminRandomTestRow[]; showUser?: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Sana</Th>
          {showUser && <Th>Foydalanuvchi</Th>}
          <Th>Turi</Th>
          <Th>To&apos;g&apos;ri / xato / javobsiz</Th>
          <Th>Foiz</Th>
          <Th>Vaqt</Th>
          <Th>Holat</Th>
          <Th> </Th>
        </tr>
      </thead>
      <tbody>
        {items.map((r) => (
          <tr key={r.id} data-testid="admin-random-row">
            <Td className="whitespace-nowrap">{formatDateTime(r.startedAt)}</Td>
            {showUser && (
              <Td>
                {r.user && (
                  <Link href={`/admin/users/${r.user.id}`} className="hover:text-brand">
                    <span className="font-semibold">{fullName(r.user)}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{r.user.login ?? formatPhone(r.user.phone)}</span>
                  </Link>
                )}
              </Td>
            )}
            <Td className="font-mono whitespace-nowrap">
              {r.size}
              {r.total !== r.size && <span className="text-xs text-muted-foreground"> ({r.total})</span>}
            </Td>
            <Td className="font-mono whitespace-nowrap">
              <span className="text-success">{r.correct}</span> / <span className="text-danger">{r.wrong}</span> / <span className="text-muted-foreground">{r.unanswered}</span>
            </Td>
            <Td>
              <ProgressBar percent={r.percent} />
            </Td>
            <Td className="font-mono">{formatClock(r.durationSec)}</Td>
            <Td>
              <Badge tone={RANDOM_STATUS[r.status].tone}>{RANDOM_STATUS[r.status].label}</Badge>
            </Td>
            <Td>
              <Link href={`/admin/random-tests/${r.id}`} className="text-sm font-semibold text-brand hover:underline">
                Savollar
              </Link>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
