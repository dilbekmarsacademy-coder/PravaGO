"use client";

// "Shu yerda o'qiydiganlar" — o'quv markaz o'quvchilari (login + parol, bitta faol qurilma).

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { KeyRoundIcon, ListPlusIcon, LogOutIcon, PencilIcon, PowerIcon, SearchIcon, UserPlusIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { formatPhone, formatRelative } from "@/lib/admin/format";
import { fullName, type Paged } from "@/lib/admin/types";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import DeleteButton from "@/components/admin/DeleteButton";
import { ProgressBar } from "@/components/admin/StatusBadges";
import { EmptyState, ErrorBlock, LoadingBlock, Pagination, Panel, Select, Table, Td, TextInput, Th } from "@/components/admin/ui";
import {
  BulkStudentsDialog,
  CreateStudentDialog,
  CredentialsDialog,
  EditStudentDialog,
  type StudentCredentials,
  type StudentRow,
} from "./StudentDialogs";

const PAGE_SIZE = 50;

/** Ikki bosqichli tasdiq (brauzer confirm() oynasisiz). */
function ConfirmAction({ icon, label, confirmLabel, onConfirm, testId }: { icon: ReactNode; label: string; confirmLabel: string; onConfirm: () => Promise<void>; testId?: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await onConfirm();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Bajarib bo'lmadi", tone: "danger" });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <Button size="sm" variant="secondary" onClick={run} disabled={busy} data-testid={testId && `${testId}-confirm`}>
          {busy ? "…" : confirmLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
          Bekor
        </Button>
      </span>
    );
  }
  return (
    <Button size="icon-sm" variant="ghost" onClick={() => setConfirming(true)} aria-label={label} title={label} data-testid={testId}>
      {icon}
    </Button>
  );
}

export default function CenterStudentsTab() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<StudentRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [credentials, setCredentials] = useState<{ title: string; list: StudentCredentials[]; errors?: { line: number; value: string; message: string }[] } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), ...(query ? { q: query } : {}), ...(status ? { status } : {}) });
    try {
      setData(await adminFetch<Paged<StudentRow>>(`students?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }, [page, query, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function action(u: StudentRow, path: string, message: string) {
    await adminFetch(`students/${u.id}/${path}`, { method: "POST" });
    showToast({ message, tone: "success" });
    load();
  }

  async function resetPassword(u: StudentRow) {
    const fresh = await adminFetch<StudentCredentials>(`students/${u.id}/reset-password`, { json: {} });
    setCredentials({ title: "Yangi parol", list: [fresh] });
    load();
  }

  async function remove(u: StudentRow) {
    await adminFetch(`students/${u.id}`, { method: "DELETE" });
    showToast({ message: `${fullName(u)} o'chirildi`, tone: "success" });
    load();
  }

  return (
    <Panel
      title="Markaz o'quvchilari"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="student-create-open">
            <UserPlusIcon className="size-4" /> O&apos;quvchi qo&apos;shish
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setBulkOpen(true)}>
            <ListPlusIcon className="size-4" /> Ommaviy qo&apos;shish
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-xs text-muted-foreground">
        O&apos;quvchi saytda &quot;Men shu yerda o&apos;qiyman&quot; tugmasi orqali telefon + login + parol bilan kiradi. Akkaunt bir vaqtda faqat bitta qurilmada ishlaydi —
        boshqa qurilmadan kirilsa, oldingisidan chiqariladi. Progress serverda saqlanadi.
      </p>
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, telefon yoki login" className="pl-9" />
        </div>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Holat"
        >
          <option value="">Holat: hammasi</option>
          <option value="active">Faol</option>
          <option value="inactive">Faolsiz</option>
        </Select>
      </div>
      {error && <ErrorBlock message={error} onRetry={load} />}
      {!data ? (
        <LoadingBlock />
      ) : data.items.length === 0 ? (
        <EmptyState>{query || status ? "O'quvchi topilmadi" : "Hali markaz o'quvchisi qo'shilmagan"}</EmptyState>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Ism</Th>
                <Th>Telefon</Th>
                <Th>Login</Th>
                <Th>Holat</Th>
                <Th>Oxirgi kirish</Th>
                <Th>Progress</Th>
                <Th>Kirish</Th>
                <Th>
                  <span className="sr-only">Amallar</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-surface" data-testid="student-row">
                  <Td>
                    <Link href={`/admin/users/${u.id}`} className="font-semibold text-foreground hover:text-brand">
                      {fullName(u)}
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs whitespace-nowrap">{formatPhone(u.phone)}</Td>
                  <Td className="font-mono text-xs">{u.login}</Td>
                  <Td>
                    <span className="inline-flex flex-col gap-1">
                      {u.isActive ? <Badge tone="success">faol</Badge> : <Badge tone="danger">faolsiz</Badge>}
                      {u.online && u.isActive && <span className="text-[0.65rem] text-success">qurilmada kirgan</span>}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {u.lastLoginAt ? (
                      <>
                        <span>{formatRelative(u.lastLoginAt)}</span>
                        <span className="block text-xs text-muted-foreground">{u.lastDevice ?? "—"}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">hali kirmagan</span>
                    )}
                  </Td>
                  <Td>
                    <ProgressBar percent={u.progress.percent} />
                    {u.progress.passedDays.length > 0 && <span className="mt-1 block font-mono text-[0.65rem] text-muted-foreground">kunlar: {u.progress.passedDays.join(", ")}</span>}
                  </Td>
                  <Td>{u.centerAccess ? <Badge tone="brand">to&apos;liq</Badge> : <Badge tone="warning">o&apos;chirilgan</Badge>}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <span className="inline-flex flex-wrap items-center justify-end gap-0.5">
                      <ConfirmAction icon={<KeyRoundIcon className="size-4" />} label="Parolni yangilash" confirmLabel="Yangi parol" onConfirm={() => resetPassword(u)} testId="student-reset" />
                      <ConfirmAction
                        icon={<LogOutIcon className="size-4" />}
                        label="Qurilmadan chiqarish"
                        confirmLabel="Chiqarish"
                        onConfirm={() => action(u, "logout", `${fullName(u)} qurilmadan chiqarildi`)}
                        testId="student-logout"
                      />
                      <ConfirmAction
                        icon={<PowerIcon className={u.isActive ? "size-4" : "size-4 text-success"} />}
                        label={u.isActive ? "Faolsizlantirish" : "Faollashtirish"}
                        confirmLabel={u.isActive ? "Faolsizlantirish" : "Faollashtirish"}
                        onConfirm={() => action(u, u.isActive ? "deactivate" : "activate", u.isActive ? "Faolsizlantirildi" : "Faollashtirildi")}
                        testId="student-toggle"
                      />
                      <Button size="icon-sm" variant="ghost" onClick={() => setEditing(u)} aria-label="Tahrirlash" title="Tahrirlash">
                        <PencilIcon className="size-4" />
                      </Button>
                      <DeleteButton iconOnly label="O'quvchini o'chirish" confirmLabel="Ha, o'chirish" onDelete={() => remove(u)} testId="student-delete" />
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
        </>
      )}

      <CreateStudentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(c) => {
          setCreateOpen(false);
          setCredentials({ title: "O'quvchi qo'shildi", list: [c] });
          load();
        }}
      />
      <BulkStudentsDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onCreated={(result) => {
          setBulkOpen(false);
          setCredentials({ title: `${result.created.length} ta o'quvchi qo'shildi`, list: result.created, errors: result.errors });
          load();
        }}
      />
      <EditStudentDialog
        student={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          showToast({ message: "Saqlandi", tone: "success" });
          load();
        }}
      />
      <CredentialsDialog list={credentials?.list ?? null} errors={credentials?.errors} title={credentials?.title} onClose={() => setCredentials(null)} />
    </Panel>
  );
}
