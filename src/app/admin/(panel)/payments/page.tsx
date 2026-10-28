"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { formatDateTime, formatPhone, formatSom } from "@/lib/admin/format";
import { fullName, type AdminPayment, type Paged } from "@/lib/admin/types";
import { Button } from "@/components/shared/Button";
import AddPaymentForm from "@/components/admin/AddPaymentForm";
import PaymentActions from "@/components/admin/PaymentActions";
import { PaymentBadge } from "@/components/admin/StatusBadges";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Pagination, Panel, Table, Tabs, Td, Th } from "@/components/admin/ui";

type Filter = "" | "PENDING" | "CONFIRMED" | "CANCELLED";

export default function AdminPaymentsPage() {
  const [status, setStatus] = useState<Filter>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<(Paged<AdminPayment> & { pendingCount: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(page), pageSize: "50", ...(status ? { status } : {}) });
      setData(await adminFetch(`payments?${q}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }, [page, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="To'lovlar"
        subtitle={data ? `Kutilayotgan so'rovlar: ${data.pendingCount}` : "Qo'lda tasdiqlanadigan to'lovlar"}
        actions={
          <Button size="sm" onClick={() => setAdding((v) => !v)}>
            <PlusIcon className="size-4" /> Qo&apos;lda to&apos;lov qo&apos;shish
          </Button>
        }
      />
      {adding && (
        <Panel title="Yangi to'lov" className="mb-6">
          <AddPaymentForm
            onDone={() => {
              setAdding(false);
              load();
            }}
          />
        </Panel>
      )}
      <Tabs
        className="mb-4"
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={[
          { value: "", label: "Hammasi" },
          { value: "PENDING", label: `Kutilmoqda${data ? ` (${data.pendingCount})` : ""}` },
          { value: "CONFIRMED", label: "Tasdiqlangan" },
          { value: "CANCELLED", label: "Bekor qilingan" },
        ]}
      />
      {error && <ErrorBlock message={error} onRetry={load} />}
      <Panel>
        {!data ? (
          <LoadingBlock />
        ) : data.items.length === 0 ? (
          <EmptyState>To&apos;lov yo&apos;q</EmptyState>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Sana</Th>
                  <Th>Foydalanuvchi</Th>
                  <Th>Summa</Th>
                  <Th>Holat</Th>
                  <Th>Izoh</Th>
                  <Th>Kim tasdiqladi</Th>
                  <Th>Amal</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className={p.status === "PENDING" ? "bg-warning/5" : undefined}>
                    <Td className="whitespace-nowrap">{formatDateTime(p.createdAt)}</Td>
                    <Td>
                      {p.user && (
                        <Link href={`/admin/users/${p.user.id}`} className="hover:text-brand">
                          <span className="font-semibold">{fullName(p.user)}</span>
                          <span className="block font-mono text-xs text-muted-foreground">{formatPhone(p.user.phone)}</span>
                        </Link>
                      )}
                    </Td>
                    <Td className="font-mono whitespace-nowrap">{formatSom(p.amount)}</Td>
                    <Td>
                      <PaymentBadge status={p.status} />
                    </Td>
                    <Td className="max-w-56 text-xs">
                      {p.userNote && <span className="block text-foreground/80">Foydalanuvchi: {p.userNote}</span>}
                      {p.note && <span className="block text-muted-foreground">Admin: {p.note}</span>}
                      {!p.userNote && !p.note && "—"}
                    </Td>
                    <Td className="text-xs">
                      {p.confirmedBy ? (
                        <>
                          {p.confirmedBy.login}
                          <span className="block text-muted-foreground">{formatDateTime(p.confirmedAt)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <PaymentActions payment={p} onDone={load} />
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
