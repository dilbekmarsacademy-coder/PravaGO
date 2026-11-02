"use client";

// AI tahlil sahifasi bloklari: "AI xarajatlari", keshlangan "AI xulosa" va "Statistikadan so'rash".

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { DatabaseIcon, RefreshCwIcon, SendIcon, SparklesIcon } from "lucide-react";
import { adminFetch } from "@/lib/admin/api";
import { formatDateTime } from "@/lib/admin/format";
import { Button } from "@/components/shared/Button";
import { ErrorBlock, Panel, Spinner, StatCard, Tabs, TextArea } from "@/components/admin/ui";
import Markdown from "@/components/admin/Markdown";

type Range = "today" | "7d" | "30d";
const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Bugun" },
  { value: "7d", label: "7 kun" },
  { value: "30d", label: "30 kun" },
];

interface Costs {
  budget: { budgetUsd: number; spentUsd: number; ratio: number; level: "ok" | "warn" | "blocked" };
  month: { total: number; imports: number; student: number; other: number; byFeature: { feature: string; costUsd: number; calls: number }[] };
  allTime: { total: number; calls: number };
  failuresLast7d: number;
  recentFailures: { feature: string; error: string | null; createdAt: string }[];
  configured: boolean;
}

const FEATURE_LABEL: Record<string, string> = {
  "import.classify": "Import: tasnif",
  "import.analyze": "Import: savollar tahlili",
  "import.match": "Import: moslashtirish",
  "import.watermark": "Import: watermark aniqlash",
  "import.verify": "Import: tozalashni tekshirish",
  translate: "Ruscha tarjima",
  watermark: "Rasm muharriri watermark",
  report: "Hisobot va xulosa",
  ask: "Statistikadan so'rash",
  student: "O'quvchi tahlili",
};

const usd = (v: number) => `$${v.toFixed(v < 1 ? 3 : 2)}`;

export function AiCostsBlock() {
  const [data, setData] = useState<Costs | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<Costs>("ai/costs")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Xatolik"));
  }, []);

  if (error) return <ErrorBlock message={error} />;
  if (!data) return null;
  const pct = Math.min(100, Math.round(data.budget.ratio * 100));
  const tone = data.budget.level === "blocked" ? "bg-danger" : data.budget.level === "warn" ? "bg-warning" : "bg-success";

  return (
    <Panel title="AI xarajatlari">
      <div data-testid="ai-costs">
        {data.budget.level !== "ok" && (
          <div className={`mb-4 rounded-xl border p-3 text-sm ${data.budget.level === "blocked" ? "border-danger/40 bg-danger/10 text-danger" : "border-warning/40 bg-warning/10 text-warning"}`} data-testid="ai-budget-warning">
            {data.budget.level === "blocked"
              ? `Oylik limit (${usd(data.budget.budgetUsd)}) tugadi — yangi AI so'rovlari to'xtatildi. Limitni AI_MONTHLY_BUDGET_USD bilan oshiring yoki keyingi oyni kuting.`
              : `Oylik limitning ${pct}% ishlatildi (${usd(data.budget.spentUsd)} / ${usd(data.budget.budgetUsd)}).`}
          </div>
        )}
        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>Bu oy: {usd(data.budget.spentUsd)}</span>
          <span>Limit: {usd(data.budget.budgetUsd)}</span>
        </div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-foreground/10">
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Bu oy" value={usd(data.month.total)} tone="brand" />
          <StatCard label="Importlar" value={usd(data.month.imports)} />
          <StatCard label="O'quvchi tahlili" value={usd(data.month.student)} />
          <StatCard label="Jami (hamma vaqt)" value={usd(data.allTime.total)} hint={`${data.allTime.calls} ta so'rov`} />
        </div>
        {data.month.byFeature.length > 0 && (
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {data.month.byFeature.map((f) => (
              <li key={f.feature} className="flex justify-between gap-3 rounded-lg px-2 py-1 odd:bg-foreground/[0.03]">
                <span className="text-muted-foreground">{FEATURE_LABEL[f.feature] ?? f.feature}</span>
                <span className="font-mono">
                  {usd(f.costUsd)} · {f.calls}
                </span>
              </li>
            ))}
          </ul>
        )}
        {data.failuresLast7d > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Oxirgi 7 kunda {data.failuresLast7d} ta muvaffaqiyatsiz so&apos;rov.
            {data.recentFailures[0]?.error && ` Oxirgisi (${FEATURE_LABEL[data.recentFailures[0].feature] ?? data.recentFailures[0].feature}): ${data.recentFailures[0].error}`}
          </p>
        )}
      </div>
    </Panel>
  );
}

interface Summary {
  text: string | null;
  createdAt?: string;
  model?: string;
}

export function AiSummaryBlock({ configured }: { configured: boolean }) {
  const [range, setRange] = useState<Range>("7d");
  const [data, setData] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminFetch<Summary>(`ai/summary?range=${range}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }, [range]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      setData(await adminFetch<Summary>(`ai/summary?range=${range}`, { method: "POST" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="AI xulosa"
      actions={
        <Button size="sm" variant="secondary" onClick={refresh} disabled={!configured || busy} data-testid="ai-summary-refresh">
          {busy ? <Spinner className="size-4" /> : data?.text ? <RefreshCwIcon className="size-4" /> : <SparklesIcon className="size-4" />}
          {data?.text ? "Yangilash" : "Xulosa olish"}
        </Button>
      }
    >
      <Tabs className="mb-3" value={range} onChange={setRange} options={RANGES} />
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      {data?.text ? (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {data.createdAt && `${formatDateTime(data.createdAt)} holatiga`} · keshdan (yangilash uchun tugmani bosing)
          </p>
          <div data-testid="ai-summary-text">
            <Markdown text={data.text} />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Bu davr uchun xulosa hali olinmagan. Yig&apos;ma statistika (shaxsiy ma&apos;lumotsiz) arzon modelga yuboriladi.</p>
      )}
    </Panel>
  );
}

interface AskResult {
  answer: string;
  sources: { name: string; input: Record<string, unknown> }[];
}

const SOURCE_LABEL: Record<string, string> = {
  getSales: "Sotuv",
  getActiveUsers: "Faol foydalanuvchilar",
  getTopWrongQuestions: "Eng ko'p xato savollar",
  getTopicStats: "Mavzular statistikasi",
  getFunnel: "Kunlar voronkasi",
};

export function AskStatsBlock({ configured }: { configured: boolean }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<(AskResult & { question: string })[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch<AskResult>("ai/ask-stats", { json: { question: question.trim() } });
      setHistory((h) => [{ ...res, question: question.trim() }, ...h].slice(0, 10));
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Statistikadan so'rash">
      <form onSubmit={submit} className="mb-4 flex flex-col gap-2">
        <TextArea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Masalan: bu hafta qaysi tarif ko'p sotildi?" disabled={!configured} data-testid="ask-stats-input" />
        <Button type="submit" size="sm" className="self-start" disabled={!configured || busy || !question.trim()} data-testid="ask-stats-submit">
          {busy ? <Spinner className="size-4 text-brand-foreground" /> : <SendIcon className="size-4" />} So&apos;rash
        </Button>
        <p className="text-xs text-muted-foreground">AI faqat tayyor metrika funksiyalarini chaqiradi (bazaga o&apos;zi so&apos;rov yozmaydi); manbalar javob ostida ko&apos;rsatiladi.</p>
      </form>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <div className="flex flex-col gap-4" data-testid="ask-stats-answers">
        {history.map((h, i) => (
          <div key={i} className="rounded-2xl border border-border p-3">
            <p className="mb-2 text-sm font-semibold">{h.question}</p>
            <Markdown text={h.answer} />
            {h.sources.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <DatabaseIcon className="size-3.5" /> Manba:
                {h.sources.map((s, k) => (
                  <span key={k} className="rounded-full bg-foreground/5 px-2 py-0.5">
                    {SOURCE_LABEL[s.name] ?? s.name}
                    {typeof s.input.range === "string" && ` (${RANGES.find((r) => r.value === s.input.range)?.label ?? s.input.range})`}
                  </span>
                ))}
              </p>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
