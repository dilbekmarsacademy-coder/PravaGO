"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/api";
import { formatDateTime } from "@/lib/admin/format";
import { Badge } from "@/components/shared/Badge";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Pagination, Panel, Select, Table, Tabs, Td, Th } from "@/components/admin/ui";

interface AuditItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
  admin: { login: string; name: string } | null;
}

interface LoginAttempt {
  id: string;
  login: string;
  ip: string;
  success: boolean;
  reason: string;
  createdAt: string;
}

const ENTITY_LABELS: Record<string, string> = {
  "": "Hammasi",
  admin: "Admin",
  user: "Foydalanuvchi",
  payment: "To'lov",
  question: "Savol",
  collection: "Yangi testlar to'plami",
  image: "Rasm",
  ai: "AI",
};

const REASONS: Record<string, string> = {
  ok: "Muvaffaqiyatli",
  bad_code: "Maxsus kod xato",
  bad_credentials: "Login/parol xato",
  inactive: "Nofaol admin",
  rate_limited: "Bloklangan (rate limit)",
};

function Diff({ before, after }: { before: unknown; after: unknown }) {
  if (before == null && after == null) return <span className="text-muted-foreground">—</span>;
  return (
    <details className="max-w-md">
      <summary className="cursor-pointer text-xs text-brand">Ko&apos;rish</summary>
      <div className="mt-2 grid gap-2 text-xs">
        {before != null && (
          <pre className="max-h-60 overflow-auto rounded-lg bg-danger/5 p-2 whitespace-pre-wrap text-foreground/80">
            {JSON.stringify(before, null, 2)}
          </pre>
        )}
        {after != null && (
          <pre className="max-h-60 overflow-auto rounded-lg bg-success/5 p-2 whitespace-pre-wrap text-foreground/80">
            {JSON.stringify(after, null, 2)}
          </pre>
        )}
      </div>
    </details>
  );
}

export default function AdminHistoryPage() {
  const [tab, setTab] = useState<"changes" | "logins">("changes");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; items: AuditItem[] } | null>(null);
  const [logins, setLogins] = useState<LoginAttempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (tab === "changes") {
        const q = new URLSearchParams({ page: String(page), pageSize: "50", ...(entityType ? { entityType } : {}) });
        setData(await adminFetch(`audit?${q}`));
      } else {
        setLogins(await adminFetch("audit/logins"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }, [tab, page, entityType]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <>
      <PageHeader title="Tarix" subtitle="Kim, qachon, nimani o'zgartirdi" />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "changes", label: "O'zgarishlar" },
          { value: "logins", label: "Kirish urinishlari" },
        ]}
      />
      {error && <ErrorBlock message={error} onRetry={load} />}
      {tab === "changes" && (
        <Panel
          actions={
            <Select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className="w-auto"
            >
              {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          }
        >
          {!data ? (
            <LoadingBlock />
          ) : data.items.length === 0 ? (
            <EmptyState>Hozircha yozuv yo&apos;q</EmptyState>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Vaqt</Th>
                    <Th>Admin</Th>
                    <Th>Amal</Th>
                    <Th>Obyekt</Th>
                    <Th>O&apos;zgarish</Th>
                    <Th>IP</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <Td className="whitespace-nowrap">{formatDateTime(item.createdAt)}</Td>
                      <Td>{item.admin ? item.admin.login : <span className="text-muted-foreground">tizim</span>}</Td>
                      <Td className="font-mono text-xs">{item.action}</Td>
                      <Td className="text-xs">
                        {ENTITY_LABELS[item.entityType] ?? item.entityType}
                        {item.entityId && <span className="block font-mono text-muted-foreground">{item.entityId.slice(0, 12)}</span>}
                      </Td>
                      <Td>
                        <Diff before={item.before} after={item.after} />
                      </Td>
                      <Td className="font-mono text-xs text-muted-foreground">{item.ip ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={page} pageSize={50} total={data.total} onPage={setPage} />
            </>
          )}
        </Panel>
      )}
      {tab === "logins" && (
        <Panel>
          {!logins ? (
            <LoadingBlock />
          ) : logins.length === 0 ? (
            <EmptyState>Hozircha urinish yo&apos;q</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Vaqt</Th>
                  <Th>Login</Th>
                  <Th>Natija</Th>
                  <Th>IP</Th>
                </tr>
              </thead>
              <tbody>
                {logins.map((row) => (
                  <tr key={row.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(row.createdAt)}</Td>
                    <Td className="font-mono">{row.login}</Td>
                    <Td>
                      <Badge tone={row.success ? "success" : row.reason === "rate_limited" ? "warning" : "danger"}>{REASONS[row.reason] ?? row.reason}</Badge>
                    </Td>
                    <Td className="font-mono text-xs text-muted-foreground">{row.ip}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      )}
    </>
  );
}
