"use client";

// "Yangi testlar" — qo'lda qo'shish: to'plamlar (admin yaratadi) → ichidagi testlar.

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, FolderIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react";
import { adminFetch, AdminApiError } from "@/lib/admin/api";
import type { Collection, TestGroup } from "@/lib/admin/collections";
import { latinToCyrillic } from "@/lib/i18n/translit";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import DeleteButton from "@/components/admin/DeleteButton";
import { EmptyState, ErrorBlock, Field, LoadingBlock, Panel, Select, TextInput } from "@/components/admin/ui";

function swap<T>(list: T[], index: number, dir: -1 | 1): T[] | null {
  const target = index + dir;
  if (target < 0 || target >= list.length) return null;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function ManualTestsPanel() {
  const [groups, setGroups] = useState<TestGroup[] | null>(null);
  const [tests, setTests] = useState<Collection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");

  const load = useCallback(async () => {
    try {
      const [g, t] = await Promise.all([adminFetch<TestGroup[]>("test-groups"), adminFetch<Collection[]>("collections")]);
      setGroups(g);
      setTests(t);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function createGroup(e: FormEvent) {
    e.preventDefault();
    if (!groupName.trim()) return;
    try {
      await adminFetch("test-groups", { json: { name: groupName.trim() } });
      setGroupName("");
      showToast({ message: "To'plam yaratildi", tone: "success" });
      load();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    }
  }

  async function moveGroup(index: number, dir: -1 | 1) {
    if (!groups) return;
    const next = swap(groups, index, dir);
    if (!next) return;
    setGroups(next);
    setGroups(await adminFetch<TestGroup[]>("test-groups/reorder", { json: { ids: next.map((g) => g.id) } }));
  }

  return (
    <>
      <Panel title="Yangi to'plam" className="mb-6">
        <form onSubmit={createGroup} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="To'plam nomi" className="flex-1" hint="Masalan: “Noyabr yangi savollari” yoki “Yo'l belgilari”. O'quvchiga shu nom bilan ko'rinadi.">
            <TextInput value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="To'plam nomi" name="group-name" data-testid="group-name" />
          </Field>
          <Button type="submit" disabled={!groupName.trim()} className="sm:mb-5" data-testid="group-create">
            <PlusIcon className="size-4" /> To&apos;plam yaratish
          </Button>
        </form>
      </Panel>
      {error && <ErrorBlock message={error} onRetry={load} />}
      {!groups ? (
        <LoadingBlock />
      ) : groups.length === 0 ? (
        <Panel>
          <EmptyState>Hali to&apos;plam yo&apos;q — avval to&apos;plam yarating, keyin unga test qo&apos;shing.</EmptyState>
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g, i) => (
            <GroupCard
              key={g.id}
              group={g}
              groups={groups}
              tests={tests.filter((t) => t.groupId === g.id).sort((a, b) => a.sortOrder - b.sortOrder)}
              first={i === 0}
              last={i === groups.length - 1}
              onMove={(dir) => moveGroup(i, dir)}
              onChange={load}
            />
          ))}
        </div>
      )}
    </>
  );
}

function GroupCard({
  group,
  groups,
  tests,
  first,
  last,
  onMove,
  onChange,
}: {
  group: TestGroup;
  groups: TestGroup[];
  tests: Collection[];
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [uz, setUz] = useState("");
  const [cyrl, setCyrl] = useState("");
  const [cyrlTouched, setCyrlTouched] = useState(false);
  const [ru, setRu] = useState("");
  const [adding, setAdding] = useState(false);

  async function rename(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await adminFetch(`test-groups/${group.id}`, { method: "PATCH", json: { name: name.trim() } });
    setEditing(false);
    onChange();
  }

  async function removeGroup() {
    await adminFetch(`test-groups/${group.id}/delete`, { json: { withTests: true } });
    showToast({ message: `"${group.name}" to'plami o'chirildi`, tone: "success" });
    onChange();
  }

  async function createTest(e: FormEvent) {
    e.preventDefault();
    if (!uz.trim()) return;
    await adminFetch("collections", { json: { groupId: group.id, title: { uz: uz.trim(), cyrl: (cyrlTouched ? cyrl : latinToCyrillic(uz)).trim(), ru: ru.trim() } } });
    setUz("");
    setCyrl("");
    setRu("");
    setCyrlTouched(false);
    setAdding(false);
    showToast({ message: "Test yaratildi (qoralama)", tone: "success" });
    onChange();
  }

  async function moveTest(index: number, dir: -1 | 1) {
    const next = swap(tests, index, dir);
    if (!next) return;
    await adminFetch("collections/reorder", { json: { ids: next.map((t) => t.id) } });
    onChange();
  }

  async function togglePublish(c: Collection) {
    try {
      await adminFetch(`collections/${c.id}`, { method: "PATCH", json: { published: !c.published } });
      showToast({ message: c.published ? "Qoralamaga qaytarildi" : "Nashr qilindi — kabinetda ko'rinadi", tone: "success" });
      onChange();
    } catch (err) {
      showToast({ message: err instanceof AdminApiError ? err.message : "Xatolik", tone: "danger" });
    }
  }

  async function moveToGroup(c: Collection, groupId: string) {
    await adminFetch(`collections/${c.id}`, { method: "PATCH", json: { groupId } });
    showToast({ message: "Test boshqa to'plamga ko'chirildi", tone: "success" });
    onChange();
  }

  async function removeTest(c: Collection) {
    await adminFetch(`collections/${c.id}`, { method: "DELETE" });
    showToast({ message: `"${c.title.uz}" o'chirildi — kabinetdan ham olindi`, tone: "success" });
    onChange();
  }

  return (
    <Panel
      title={
        editing ? (
          <form onSubmit={rename} className="flex items-center gap-2">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} className="h-9" autoFocus name="group-rename" />
            <Button size="icon-sm" type="submit" aria-label="Saqlash">
              <CheckIcon className="size-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => setEditing(false)} aria-label="Bekor">
              <XIcon className="size-4" />
            </Button>
          </form>
        ) : (
          <span className="inline-flex items-center gap-2" data-testid="group-title">
            <FolderIcon className="size-4 text-brand" />
            {group.name}
            <Badge>{tests.length} test</Badge>
          </span>
        )
      }
      actions={
        <span className="inline-flex items-center gap-0.5">
          <Button size="icon-sm" variant="ghost" onClick={() => onMove(-1)} disabled={first} aria-label="To'plamni yuqoriga">
            <ArrowUpIcon className="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => onMove(1)} disabled={last} aria-label="To'plamni pastga">
            <ArrowDownIcon className="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setEditing(true)} aria-label="Nomini o'zgartirish" title="Nomini o'zgartirish">
            <PencilIcon className="size-4" />
          </Button>
          <DeleteButton
            iconOnly
            label="To'plamni o'chirish"
            confirmLabel={tests.length ? `Ha, ${tests.length} ta testi bilan o'chirish` : "Ha, o'chirish"}
            onDelete={removeGroup}
            testId="group-delete"
          />
        </span>
      }
    >
      {tests.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">Bu to&apos;plamda hali test yo&apos;q.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tests.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3" data-testid="test-row">
              <div className="flex flex-col">
                <Button size="icon-sm" variant="ghost" onClick={() => moveTest(i, -1)} disabled={i === 0} aria-label="Yuqoriga">
                  <ArrowUpIcon className="size-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => moveTest(i, 1)} disabled={i === tests.length - 1} aria-label="Pastga">
                  <ArrowDownIcon className="size-4" />
                </Button>
              </div>
              <Link href={`/admin/new-tests/${c.id}`} className="min-w-0 flex-1 hover:text-brand">
                <p className="font-semibold">{c.title.uz}</p>
                <p className="text-xs text-muted-foreground">
                  {c.title.cyrl} {c.title.ru && `· ${c.title.ru}`}
                  {c.linkedDay ? ` · ${c.linkedDay}-kun mavzusiga havola` : ""}
                </p>
              </Link>
              <Badge>{c.questionCount} savol</Badge>
              {c.published ? <Badge tone="success">nashr qilingan</Badge> : <Badge tone="muted">qoralama</Badge>}
              {groups.length > 1 && (
                <Select value={group.id} onChange={(e) => moveToGroup(c, e.target.value)} aria-label="Boshqa to'plamga ko'chirish" className="h-9 w-auto max-w-48 text-xs">
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.id === group.id ? `To'plam: ${g.name}` : `→ ${g.name}`}
                    </option>
                  ))}
                </Select>
              )}
              <Button size="sm" variant={c.published ? "secondary" : "primary"} onClick={() => togglePublish(c)}>
                {c.published ? "Qoralamaga" : "Nashr qilish"}
              </Button>
              <DeleteButton iconOnly label="Testni o'chirish" confirmLabel="Ha, testni o'chirish" onDelete={() => removeTest(c)} testId="collection-delete" />
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form onSubmit={createTest} className="mt-4 grid gap-3 rounded-xl border border-dashed border-border p-3 sm:grid-cols-3">
          <Field label="Test nomi (lotin)">
            <TextInput value={uz} onChange={(e) => setUz(e.target.value)} placeholder="Masalan: 2-kun 1-mavzu: Ogohlantiruvchi belgilar" name="title-uz" autoFocus />
          </Field>
          <Field label="Nomi (kirill)" hint={cyrlTouched ? undefined : "Lotindan avtomatik"}>
            <TextInput
              value={cyrlTouched ? cyrl : latinToCyrillic(uz)}
              onChange={(e) => {
                setCyrlTouched(true);
                setCyrl(e.target.value);
              }}
              name="title-cyrl"
            />
          </Field>
          <Field label="Nomi (rus)">
            <TextInput value={ru} onChange={(e) => setRu(e.target.value)} name="title-ru" />
          </Field>
          <div className="flex gap-2 sm:col-span-3">
            <Button type="submit" disabled={!uz.trim()} data-testid="test-create">
              <PlusIcon className="size-4" /> Test yaratish
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Bekor
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="secondary" className="mt-4" onClick={() => setAdding(true)} data-testid="test-add-open">
          <PlusIcon className="size-4" /> Test qo&apos;shish
        </Button>
      )}
    </Panel>
  );
}
