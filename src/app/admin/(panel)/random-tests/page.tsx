"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/api";
import type { Paged } from "@/lib/admin/types";
import RandomTestsTable, { type AdminRandomTestRow, type RandomTestStatus } from "@/components/admin/RandomTestsTable";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Pagination, Panel, Tabs, TextInput } from "@/components/admin/ui";

/** Barcha foydalanuvchilarning random test urinishlari: qidiruv (ism, telefon) va holat bo'yicha filtr. */
export default function AdminRandomTestsPage() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | RandomTestStatus>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminRandomTestRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Foydalanuvchi sahifasidan "Hammasi" — ?userId=... bo'yicha filtr.
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserId(new URLSearchParams(window.location.search).get("userId"));
  }, []);

  // Qidiruv yozib bo'lingach (300 ms) yuboriladi.
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const load = useCallback(async () => {
    if (userId === undefined) return;
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "50", ...(query ? { q: query } : {}), ...(userId ? { userId } : {}), ...(status ? { status } : {}) });
      setData(await adminFetch(`random-tests?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }, [page, query, status, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <>
      <PageHeader title="Random testlar" subtitle={data ? `Jami urinishlar: ${data.total}${userId ? " · bitta foydalanuvchi" : ""}` : "Foydalanuvchilarning tasodifiy test natijalari"} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, familiya yoki telefon" className="sm:max-w-xs" name="random-search" data-testid="admin-random-search" />
        <Tabs
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "", label: "Hammasi" },
            { value: "finished", label: "Tugallangan" },
            { value: "expired", label: "Vaqt tugagan" },
            { value: "in_progress", label: "Tugallanmagan" },
          ]}
        />
      </div>
      {error && <ErrorBlock message={error} onRetry={load} />}
      <Panel>
        {!data ? (
          <LoadingBlock />
        ) : data.items.length === 0 ? (
          <EmptyState>Urinish yo&apos;q</EmptyState>
        ) : (
          <>
            <RandomTestsTable items={data.items} showUser />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
