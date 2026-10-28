"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { SendIcon, SparklesIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { formatDateTime } from "@/lib/admin/format";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Panel, Spinner, TextArea } from "@/components/admin/ui";

interface ReportSummary {
  id: string;
  kind: "weekly" | "manual";
  periodDays: number;
  createdAt: string;
}

interface Report extends ReportSummary {
  content: string;
  messages: { id: string; role: "user" | "assistant"; content: string; createdAt: string }[];
}

/** Oddiy markdown: sarlavhalar, ro'yxatlar, qalin matn (HTML kiritilmaydi). */
function Markdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed">
      {text.split("\n").map((line, i) => {
        const bold = (s: string) => s.split(/\*\*(.+?)\*\*/g).map((part, j) => (j % 2 ? <b key={j}>{part}</b> : part));
        if (/^#{1,6}\s/.test(line)) return <h3 key={i} className="mt-2 font-display text-base font-bold">{bold(line.replace(/^#+\s/, ""))}</h3>;
        if (/^\s*[-*]\s/.test(line)) return <p key={i} className="pl-4 before:-ml-3 before:mr-1.5 before:content-['•']">{bold(line.replace(/^\s*[-*]\s/, ""))}</p>;
        if (/^\s*\d+\.\s/.test(line)) return <p key={i} className="pl-1">{bold(line)}</p>;
        return line.trim() ? <p key={i}>{bold(line)}</p> : null;
      })}
    </div>
  );
}

export default function AdminAiPage() {
  const [list, setList] = useState<{ configured: boolean; items: ReportSummary[] } | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState<"generate" | "ask" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminFetch<{ configured: boolean; items: ReportSummary[] }>("ai/reports");
      setList(data);
      if (data.items[0]) setReport(await adminFetch<Report>(`ai/reports/${data.items[0].id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function generate() {
    setBusy("generate");
    setError(null);
    try {
      const created = await adminFetch<Report>("ai/reports", { method: "POST" });
      setReport(await adminFetch<Report>(`ai/reports/${created.id}`));
      const data = await adminFetch<{ configured: boolean; items: ReportSummary[] }>("ai/reports");
      setList(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(null);
    }
  }

  async function ask(e: FormEvent) {
    e.preventDefault();
    if (!report || !question.trim()) return;
    setBusy("ask");
    try {
      setReport(await adminFetch<Report>(`ai/reports/${report.id}/ask`, { json: { question } }));
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="AI tahlil"
        subtitle="Yig'ma statistika Claude'ga yuboriladi (ism va telefon yuborilmaydi). Haftalik hisobot har dushanba avtomatik."
        actions={
          list && (
            <Button onClick={generate} disabled={!list.configured || busy !== null}>
              {busy === "generate" ? <Spinner className="size-4 text-brand-foreground" /> : <SparklesIcon className="size-4" />} Hisobot yaratish
            </Button>
          )
        }
      />
      {list && !list.configured && (
        <Panel className="mb-6">
          <div className="flex items-center gap-2 text-sm">
            <Badge tone="muted">sozlanmagan</Badge>
            AI qismi uchun backend&apos;da <code className="font-mono">ANTHROPIC_API_KEY</code> kerak. Statistika sahifasi kalitsiz ham ishlaydi.
          </div>
        </Panel>
      )}
      {error && <ErrorBlock message={error} />}
      {!list ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <Panel title="Hisobotlar">
            {list.items.length === 0 ? (
              <EmptyState>Hali hisobot yo&apos;q</EmptyState>
            ) : (
              <ul className="flex flex-col gap-1">
                {list.items.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={async () => setReport(await adminFetch<Report>(`ai/reports/${r.id}`))}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-surface ${report?.id === r.id ? "bg-brand/10 text-brand" : ""}`}
                    >
                      {formatDateTime(r.createdAt)}
                      <span className="block text-xs text-muted-foreground">
                        {r.kind === "weekly" ? "Haftalik" : "Qo'lda"} · {r.periodDays} kun
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {report && (
            <div className="flex flex-col gap-6">
              <Panel title={`Hisobot · ${formatDateTime(report.createdAt)}`}>
                <Markdown text={report.content} />
              </Panel>
              <Panel title="Hisobot bo'yicha savol">
                <div className="mb-4 flex flex-col gap-3">
                  {report.messages.map((m) => (
                    <div key={m.id} className={m.role === "user" ? "self-end rounded-2xl bg-brand/10 px-3 py-2 text-sm" : "rounded-2xl border border-border px-3 py-2"}>
                      {m.role === "user" ? m.content : <Markdown text={m.content} />}
                    </div>
                  ))}
                </div>
                <form onSubmit={ask} className="flex flex-col gap-2">
                  <TextArea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Masalan: qaysi kunda eng ko'p tashlab ketishyapti?" disabled={!list.configured} />
                  <Button type="submit" size="sm" className="self-start" disabled={!list.configured || busy !== null || !question.trim()}>
                    {busy === "ask" ? <Spinner className="size-4 text-brand-foreground" /> : <SendIcon className="size-4" />} So&apos;rash
                  </Button>
                </form>
              </Panel>
            </div>
          )}
        </div>
      )}
    </>
  );
}
