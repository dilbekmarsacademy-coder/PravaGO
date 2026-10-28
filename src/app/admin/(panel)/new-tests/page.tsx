"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import type { Collection } from "@/lib/admin/collections";
import { latinToCyrillic } from "@/lib/i18n/translit";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { EmptyState, ErrorBlock, Field, LoadingBlock, PageHeader, Panel, TextInput } from "@/components/admin/ui";

export default function AdminNewTestsPage() {
  const [items, setItems] = useState<Collection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uz, setUz] = useState("");
  const [cyrl, setCyrl] = useState("");
  const [cyrlTouched, setCyrlTouched] = useState(false);
  const [ru, setRu] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await adminFetch<Collection[]>("collections"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!uz.trim()) return;
    await adminFetch("collections", { json: { title: { uz: uz.trim(), cyrl: (cyrlTouched ? cyrl : latinToCyrillic(uz)).trim(), ru: ru.trim() } } });
    setUz("");
    setCyrl("");
    setRu("");
    setCyrlTouched(false);
    showToast({ message: "To'plam yaratildi (qoralama)", tone: "success" });
    load();
  }

  async function move(index: number, dir: -1 | 1) {
    if (!items) return;
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setItems(await adminFetch<Collection[]>("collections/reorder", { json: { ids: next.map((c) => c.id) } }));
  }

  async function togglePublish(c: Collection) {
    try {
      await adminFetch(`collections/${c.id}`, { method: "PATCH", json: { published: !c.published } });
      showToast({ message: c.published ? "Qoralamaga qaytarildi" : "Nashr qilindi — kabinetda ko'rinadi", tone: "success" });
      load();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    }
  }

  return (
    <>
      <PageHeader title="Yangi testlar" subtitle="Admin qo'shadigan to'plamlar — kabinetda to'lov qilganlarga ko'rinadi (faqat nashr qilinganlari)." />
      <Panel title="Yangi to'plam" className="mb-6">
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-3">
          <Field label="Nomi (lotin)">
            <TextInput value={uz} onChange={(e) => setUz(e.target.value)} placeholder="Masalan: Yangi savollar — noyabr" name="title-uz" />
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
          <Button type="submit" disabled={!uz.trim()} className="self-start">
            <PlusIcon className="size-4" /> Yaratish
          </Button>
        </form>
      </Panel>
      {error && <ErrorBlock message={error} onRetry={load} />}
      <Panel title="To'plamlar">
        {!items ? (
          <LoadingBlock />
        ) : items.length === 0 ? (
          <EmptyState>Hali to&apos;plam yo&apos;q</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                <div className="flex flex-col">
                  <Button size="icon-sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Yuqoriga">
                    <ArrowUpIcon className="size-4" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Pastga">
                    <ArrowDownIcon className="size-4" />
                  </Button>
                </div>
                <Link href={`/admin/new-tests/${c.id}`} className="min-w-0 flex-1 hover:text-brand">
                  <p className="font-semibold">{c.title.uz}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.title.cyrl} {c.title.ru && `· ${c.title.ru}`}
                  </p>
                </Link>
                <Badge>{c.questionCount} savol</Badge>
                {c.published ? <Badge tone="success">nashr qilingan</Badge> : <Badge tone="muted">qoralama</Badge>}
                <Button size="sm" variant={c.published ? "secondary" : "primary"} onClick={() => togglePublish(c)}>
                  {c.published ? "Qoralamaga" : "Nashr qilish"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
