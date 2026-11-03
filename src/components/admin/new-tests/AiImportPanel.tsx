"use client";

// "AI bilan fayllardan qo'shish": to'plam (majburiy) + fayllar → yuklash → import sahifasi
// (ochish, taxminiy narx, "Boshlash", progress, tekshiruv). Pastda — oldingi importlar.

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUpIcon, SparklesIcon, Trash2Icon, UploadCloudIcon, XIcon } from "lucide-react";
import { adminFetch, AdminApiError } from "@/lib/admin/api";
import type { TestGroup } from "@/lib/admin/collections";
import {
  ACCEPTED_EXTENSIONS,
  fileExtension,
  formatBytes,
  MAX_FILE_BYTES,
  STATUS_LABEL,
  uploadImportFile,
  type CreateResult,
  type ImportListItem,
} from "@/lib/admin/ai-import";
import { formatDateTime } from "@/lib/admin/format";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { showToast } from "@/components/shared/Toast";
import { EmptyState, Field, Panel, Select, Spinner, Table, Td, TextInput, Th } from "@/components/admin/ui";
import WatermarkSampleSetting from "./WatermarkSampleSetting";

const NEW_GROUP = "__new__";

type FileState = "uploading" | "done" | "error";

export function statusTone(status: string): "success" | "warning" | "danger" | "brand" | "muted" {
  if (status === "done" || status === "approved") return "success";
  if (status === "review") return "brand";
  if (status === "partial_error" || status === "paused") return "danger";
  if (status === "ready") return "warning";
  return "muted";
}

const fileKey = (f: File) => `${f.name}:${f.size}`;

export default function AiImportPanel() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [groups, setGroups] = useState<TestGroup[]>([]);
  const [groupId, setGroupId] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileState, setFileState] = useState<Record<string, FileState>>({});
  const [removeWatermarks, setRemoveWatermarks] = useState(true);
  const [day, setDay] = useState("");
  const [topic, setTopic] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [imports, setImports] = useState<ImportListItem[] | null>(null);
  const [toDelete, setToDelete] = useState<ImportListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, list] = await Promise.all([adminFetch<TestGroup[]>("test-groups"), adminFetch<ImportListItem[]>("ai-imports")]);
      setGroups(g);
      setImports(list);
      setGroupId((cur) => cur || (g.length ? g[0].id : NEW_GROUP));
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function addFiles(list: FileList | File[]) {
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of Array.from(list)) {
      if (!ACCEPTED_EXTENSIONS.includes(fileExtension(f.name))) rejected.push(`${f.name}: qabul qilinmaydigan tur`);
      else if (f.size > MAX_FILE_BYTES) rejected.push(`${f.name}: 50 MB dan katta`);
      else accepted.push(f);
    }
    if (rejected.length) showToast({ message: rejected.join("; "), tone: "danger" });
    setFiles((cur) => {
      const keys = new Set(cur.map(fileKey));
      return [...cur, ...accepted.filter((f) => !keys.has(fileKey(f)))];
    });
    setLimitError(null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  const groupOk = groupId === NEW_GROUP ? newGroup.trim().length > 0 : Boolean(groupId);
  const topicSlug = day && topic ? `day${day}-topic${topic}` : undefined;

  async function removeImport() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await adminFetch(`ai-imports/${toDelete.id}/delete`, { method: "POST" });
      setImports((cur) => cur?.filter((x) => x.id !== toDelete.id) ?? cur);
      showToast({ message: "Import o'chirildi", tone: "success" });
      setToDelete(null);
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
    } finally {
      setDeleting(false);
    }
  }

  async function submit() {
    if (!files.length || !groupOk) return;
    setBusy(true);
    setLimitError(null);
    try {
      const created = await adminFetch<CreateResult>("ai-imports", {
        json: {
          ...(groupId === NEW_GROUP ? { newGroupName: newGroup.trim() } : { groupId }),
          removeWatermarks,
          ...(day ? { hintDay: Number(day) } : {}),
          ...(topicSlug ? { hintTopicSlug: topicSlug } : {}),
          files: files.map((f) => ({ name: f.name, size: f.size, ...(f.type ? { type: f.type } : {}) })),
        },
      });
      for (const [i, upload] of created.uploads.entries()) {
        const f = files[i];
        setFileState((s) => ({ ...s, [fileKey(f)]: "uploading" }));
        try {
          await uploadImportFile(created.batchId, upload, f);
          setFileState((s) => ({ ...s, [fileKey(f)]: "done" }));
        } catch (err) {
          setFileState((s) => ({ ...s, [fileKey(f)]: "error" }));
          showToast({ message: err instanceof Error ? err.message : `${f.name} yuklanmadi`, tone: "danger" });
        }
      }
      router.push(`/admin/new-tests/ai/${created.batchId}`);
    } catch (err) {
      if (err instanceof AdminApiError && err.code === "FILE_TOO_LARGE_FOR_STORAGE") setLimitError(err.message);
      else showToast({ message: err instanceof Error ? err.message : "Xatolik", tone: "danger" });
      setBusy(false);
    }
  }

  return (
    <>
      <Panel title="Fayllardan test qo'shish" className="mb-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="To'plam *" hint="Testlar shu to'plamga qo'shiladi. Yangi nom yozsangiz — to'plam yaratiladi.">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} data-testid="ai-group">
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.testCount} ta test)
                </option>
              ))}
              <option value={NEW_GROUP}>+ Yangi to&apos;plam…</option>
            </Select>
          </Field>
          {groupId === NEW_GROUP && (
            <Field label="Yangi to'plam nomi *">
              <TextInput value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="Masalan: Noyabr yangi savollari" data-testid="ai-new-group" />
            </Field>
          )}
        </div>

        <div
          role="button"
          tabIndex={0}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${dragging ? "border-brand bg-brand/5" : "border-border hover:border-border-strong"}`}
          data-testid="ai-dropzone"
        >
          <UploadCloudIcon className="size-8 text-muted-foreground" />
          <p className="font-semibold">Fayllarni shu yerga tashlang yoki tanlang</p>
          <p className="text-xs text-muted-foreground">.docx, .pdf, .html, .txt, .zip — har biri 50 MB gacha. Bir nechta faylni birdaniga yuklash mumkin.</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            data-testid="ai-file-input"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {limitError && (
          <div className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning" data-testid="ai-limit-error">
            {limitError}
          </div>
        )}

        {files.length > 0 && (
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border" data-testid="ai-file-list">
            {files.map((f) => {
              const st = fileState[fileKey(f)];
              return (
                <li key={fileKey(f)} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <FileUpIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                  {st === "uploading" && <Spinner className="size-4" />}
                  {st === "done" && <Badge tone="success">yuklandi</Badge>}
                  {st === "error" && <Badge tone="danger">xato</Badge>}
                  {!busy && (
                    <button type="button" aria-label="Olib tashlash" className="text-muted-foreground hover:text-danger" onClick={() => setFiles((cur) => cur.filter((x) => x !== f))}>
                      <XIcon className="size-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="flex items-center gap-2 text-sm md:col-span-3">
            <input type="checkbox" checked={removeWatermarks} onChange={(e) => setRemoveWatermarks(e.target.checked)} className="size-4 accent-brand" data-testid="ai-watermark" />
            Rasmlardagi watermark (boshqa sayt logotipi yoki yozuvi)ni olib tashlash
          </label>
          <Field label="Kun (ixtiyoriy)" hint="Fayllarda kun yozilmagan bo'lsa">
            <Select value={day} onChange={(e) => setDay(e.target.value)}>
              <option value="">Fayldan aniqlansin</option>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {d}-kun
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mavzu (ixtiyoriy)">
            <TextInput type="number" min={1} max={20} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Masalan: 2" disabled={!day} />
          </Field>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={busy || !files.length || !groupOk} data-testid="ai-upload">
            {busy ? <Spinner className="size-4" /> : <SparklesIcon className="size-4" />}
            Yuklash va ochish
          </Button>
          <p className="text-xs text-muted-foreground">Keyingi qadamda taxminiy AI narxi ko&apos;rsatiladi — &ldquo;Boshlash&rdquo;ni bosmaguningizcha AI ishlamaydi.</p>
        </div>
      </Panel>

      <Panel title="AI importlar" className="mb-6">
        {!imports ? (
          <Spinner />
        ) : !imports.length ? (
          <EmptyState>Hali import yo&apos;q.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Sana</Th>
                <Th>To&apos;plam</Th>
                <Th>Fayllar</Th>
                <Th>Savollar</Th>
                <Th>Holat</Th>
                <Th>Kim</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {imports.map((r) => (
                <tr key={r.id} className="hover:bg-surface">
                  <Td>
                    <Link href={`/admin/new-tests/ai/${r.id}`} className="font-semibold text-brand hover:underline">
                      {formatDateTime(r.createdAt)}
                    </Link>
                  </Td>
                  <Td>{r.groupName ?? "—"}</Td>
                  <Td>{r.fileCount}</Td>
                  <Td>{r.stats.questions?.total ?? "—"}</Td>
                  <Td>
                    <Badge tone={statusTone(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                  </Td>
                  <Td>{r.createdBy ?? "—"}</Td>
                  <Td>
                    <button type="button" aria-label="Importni o'chirish" title="Ro'yxatdan o'chirish" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger" onClick={() => setToDelete(r)} data-testid="ai-import-delete">
                      <Trash2Icon className="size-4" />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <WatermarkSampleSetting />

      <Modal
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Importni o'chirish"
        description="Import ro'yxatdan o'chadi. Chiqarilgan testlar va ularning savollari saytda qoladi; chiqarilmagan qoralamalar o'chib ketadi."
      >
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setToDelete(null)}>
            Bekor qilish
          </Button>
          <Button variant="danger" onClick={removeImport} disabled={deleting} data-testid="ai-import-delete-confirm">
            {deleting ? <Spinner className="size-4" /> : <Trash2Icon className="size-4" />} O&apos;chirish
          </Button>
        </div>
      </Modal>
    </>
  );
}
