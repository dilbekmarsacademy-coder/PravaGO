"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin/api";
import { formatDateTime, formatPhone } from "@/lib/admin/format";
import { fullName } from "@/lib/admin/types";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { Panel, Table, Td, TextInput, Th } from "@/components/admin/ui";

interface MentorRow {
  id: string;
  activatedAt: string;
  mentorAssignedAt: string | null;
  mentorNote: string | null;
  user: { id: string; firstName: string | null; lastName: string | null; phone: string | null };
}

/** To'langan Mentor tariflari: jonli dars qo'lda kelishiladi, bu yerda faqat belgi va izoh. */
export default function MentorPanel() {
  const [data, setData] = useState<{ unassigned: number; items: MentorRow[] } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    adminFetch<{ unassigned: number; items: MentorRow[] }>("payments/mentor")
      .then(setData)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(row: MentorRow, assigned: boolean) {
    setBusy(row.id);
    try {
      await adminFetch(`payments/mentor/${row.id}`, { json: { assigned, note: notes[row.id] ?? row.mentorNote ?? "" } });
      load();
    } catch (err) {
      showToast({ tone: "danger", message: err instanceof Error ? err.message : "Bajarib bo'lmadi" });
    } finally {
      setBusy(null);
    }
  }

  if (!data?.items.length) return null;
  return (
    <Panel title={`Mentor: jonli dars${data.unassigned ? ` — tayinlanmagan: ${data.unassigned}` : ""}`} className="mb-6">
      <Table>
        <thead>
          <tr>
            <Th>To&apos;langan</Th>
            <Th>Foydalanuvchi</Th>
            <Th>Holat</Th>
            <Th>Izoh (dars vaqti, ustoz)</Th>
            <Th>Amal</Th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((row) => (
            <tr key={row.id} data-testid="mentor-row" className={row.mentorAssignedAt ? undefined : "bg-warning/5"}>
              <Td className="whitespace-nowrap">{formatDateTime(row.activatedAt)}</Td>
              <Td>
                <Link href={`/admin/users/${row.user.id}`} className="hover:text-brand">
                  <span className="font-semibold">{fullName(row.user)}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{formatPhone(row.user.phone)}</span>
                </Link>
              </Td>
              <Td>{row.mentorAssignedAt ? <Badge tone="success">Tayinlangan</Badge> : <Badge tone="warning">Mentor: jonli dars tayinlanmagan</Badge>}</Td>
              <Td>
                <TextInput value={notes[row.id] ?? row.mentorNote ?? ""} maxLength={500} aria-label="Izoh" onChange={(e) => setNotes((n) => ({ ...n, [row.id]: e.target.value }))} />
              </Td>
              <Td>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy === row.id} onClick={() => save(row, true)}>
                    {row.mentorAssignedAt ? "Izohni saqlash" : "Tayinlandi"}
                  </Button>
                  {row.mentorAssignedAt && (
                    <Button size="sm" variant="secondary" disabled={busy === row.id} onClick={() => save(row, false)}>
                      Qaytarish
                    </Button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}
