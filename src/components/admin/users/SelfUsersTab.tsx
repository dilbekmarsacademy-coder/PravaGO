"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DownloadIcon, SearchIcon } from "lucide-react";
import { adminDownloadUrl, adminFetch } from "@/lib/admin/api";
import { formatDate, formatPhone, formatRelative } from "@/lib/admin/format";
import { fullName, type AdminUserRow, type Paged } from "@/lib/admin/types";
import { buttonClasses } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import DeleteButton from "@/components/admin/DeleteButton";
import { ProgressBar, UserPaymentBadge } from "@/components/admin/StatusBadges";
import { EmptyState, ErrorBlock, LoadingBlock, Pagination, Panel, Select, Table, Td, TextInput, Th } from "@/components/admin/ui";

type SortKey = "registeredAt" | "lastActiveAt" | "name" | "progress";

/** "Yangi foydalanuvchilar" (type=SELF) — oldingi ro'yxat o'zgarishsiz. */
export default function SelfUsersTab() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState("");
  const [activity, setActivity] = useState("");
  const [sort, setSort] = useState<SortKey>("registeredAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminUserRow> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Qidiruv — yozib bo'lgach 300 ms kutib.
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const params = new URLSearchParams({
    sort,
    dir,
    ...(query ? { q: query } : {}),
    ...(payment ? { payment } : {}),
    ...(activity ? { activity } : {}),
  });
  const paramString = params.toString();

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await adminFetch<Paged<AdminUserRow>>(`users?${paramString}&page=${page}&pageSize=50`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }, [paramString, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function remove(u: AdminUserRow) {
    await adminFetch(`users/${u.id}`, { method: "DELETE" });
    showToast({ message: `${fullName(u)} o'chirildi`, tone: "success" });
    load();
  }

  function toggleSort(key: SortKey) {
    if (sort === key) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setDir(key === "name" ? "asc" : "desc");
    }
    setPage(1);
  }

  return (
    <>
      <Panel
        actions={
          <a href={adminDownloadUrl(`users/export.csv?${paramString}`)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <DownloadIcon className="size-4" /> CSV eksport
          </a>
        }
        title="O'zi ro'yxatdan o'tganlar"
      >
        <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, familiya yoki telefon" className="pl-9" />
          </div>
          <Select
            value={payment}
            onChange={(e) => {
              setPayment(e.target.value);
              setPage(1);
            }}
            aria-label="To'lov holati"
          >
            <option value="">To&apos;lov: hammasi</option>
            <option value="paid">To&apos;lagan</option>
            <option value="unpaid">To&apos;lamagan</option>
            <option value="pending">Kutilmoqda</option>
          </Select>
          <Select
            value={activity}
            onChange={(e) => {
              setActivity(e.target.value);
              setPage(1);
            }}
            aria-label="Faollik"
          >
            <option value="">Faollik: hammasi</option>
            <option value="active">Faol (7 kun)</option>
            <option value="inactive">Nofaol</option>
          </Select>
        </div>
        {error && <ErrorBlock message={error} onRetry={load} />}
        {!data ? (
          <LoadingBlock />
        ) : data.items.length === 0 ? (
          <EmptyState>Foydalanuvchi topilmadi</EmptyState>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th onClick={() => toggleSort("name")} active={sort === "name"} dir={dir}>
                    Ism
                  </Th>
                  <Th>Telefon</Th>
                  <Th onClick={() => toggleSort("registeredAt")} active={sort === "registeredAt"} dir={dir}>
                    Ro&apos;yxatdan o&apos;tgan
                  </Th>
                  <Th onClick={() => toggleSort("lastActiveAt")} active={sort === "lastActiveAt"} dir={dir}>
                    Oxirgi faollik
                  </Th>
                  <Th>To&apos;lov</Th>
                  <Th onClick={() => toggleSort("progress")} active={sort === "progress"} dir={dir}>
                    Progress
                  </Th>
                  <Th>O&apos;tilgan kunlar</Th>
                  <Th>
                    <span className="sr-only">Amallar</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-surface">
                    <Td>
                      <Link href={`/admin/users/${u.id}`} className="font-semibold text-foreground hover:text-brand">
                        {fullName(u)}
                      </Link>
                    </Td>
                    <Td className="font-mono text-xs whitespace-nowrap">{formatPhone(u.phone)}</Td>
                    <Td className="whitespace-nowrap">{formatDate(u.registeredAt)}</Td>
                    <Td className="whitespace-nowrap">
                      <span className={u.active ? "text-success" : "text-muted-foreground"}>{formatRelative(u.lastActiveAt)}</span>
                    </Td>
                    <Td>
                      <UserPaymentBadge status={u.paymentStatus} />
                    </Td>
                    <Td>
                      <ProgressBar percent={u.progress.percent} />
                    </Td>
                    <Td className="font-mono text-xs">{u.progress.passedDays.length ? u.progress.passedDays.join(", ") : "—"}</Td>
                    <Td className="text-right whitespace-nowrap">
                      <DeleteButton iconOnly label="Foydalanuvchini o'chirish" confirmLabel="Ha, butunlay o'chirish" onDelete={() => remove(u)} testId="user-delete" />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={50} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
