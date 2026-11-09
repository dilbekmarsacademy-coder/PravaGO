"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin/api";
import { formatDateTime, formatPhone } from "@/lib/admin/format";
import { fullName, type Paged } from "@/lib/admin/types";
import { EXAM_TYPE_LABEL, formatPercent, type FinalExamType } from "@/lib/api/final-exam";
import { Badge } from "@/components/shared/Badge";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Pagination, Panel, Table, Td, TextInput, Th } from "@/components/admin/ui";

interface Row {
  user: { id: string; firstName: string | null; lastName: string | null; phone: string | null; login: string | null; type: string };
  lastStartedAt: string | null;
  types: { type: FinalExamType; attemptsUsed: number; average: number | null; certificateNumber: string | null }[];
}

/** Yakuniy ichki imtihon: topshirganlar, har tur bo'yicha urinishlar, o'rtacha va sertifikat. */
export default function AdminFinalExamPage() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Row> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "50", ...(query ? { q: query } : {}) });
      setData(await adminFetch(`final-exam?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }, [page, query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Yakuniy imtihon"
        subtitle={data ? `Topshirganlar: ${data.total} · urinishlarni nolga qaytarish — foydalanuvchi sahifasida` : "7-kun: 20 talik va 50 talik ichki imtihon natijalari"}
      />
      <div className="mb-4">
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, familiya yoki telefon" className="sm:max-w-xs" name="final-search" />
      </div>
      {error && <ErrorBlock message={error} onRetry={load} />}
      <Panel>
        {!data ? (
          <LoadingBlock />
        ) : data.items.length === 0 ? (
          <EmptyState>Hali hech kim yakuniy imtihon topshirmagan</EmptyState>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Foydalanuvchi</Th>
                  {(["Q20", "Q50"] as const).map((t) => (
                    <Th key={t}>{EXAM_TYPE_LABEL[t]}</Th>
                  ))}
                  <Th>Oxirgi urinish</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.user.id} data-testid="admin-final-user">
                    <Td>
                      <Link href={`/admin/users/${r.user.id}`} className="hover:text-brand">
                        <span className="font-semibold">{fullName(r.user)}</span>
                        <span className="block font-mono text-xs text-muted-foreground">{r.user.login ?? formatPhone(r.user.phone)}</span>
                      </Link>
                    </Td>
                    {r.types.map((t) => (
                      <Td key={t.type} className="whitespace-nowrap">
                        <span className="font-mono">{t.attemptsUsed}/10</span>
                        <span className="ml-2 text-sm text-muted-foreground">{t.average !== null ? formatPercent(t.average) : "—"}</span>
                        {t.certificateNumber ? (
                          <Badge tone="success" className="ml-2">
                            sertifikat
                          </Badge>
                        ) : t.attemptsUsed >= 10 ? (
                          <Badge tone="warning" className="ml-2">
                            o&apos;tmadi
                          </Badge>
                        ) : null}
                      </Td>
                    ))}
                    <Td className="whitespace-nowrap">{formatDateTime(r.lastStartedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
