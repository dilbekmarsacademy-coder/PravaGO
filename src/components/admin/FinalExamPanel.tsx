"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/api";
import { formatDateTime } from "@/lib/admin/format";
import { EXAM_TYPE_LABEL, formatPercent, type AttemptSummary, type FinalExamType } from "@/lib/api/final-exam";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { showToast } from "@/components/shared/Toast";
import { EmptyState, LoadingBlock, Panel, Table, Td, Th } from "@/components/admin/ui";

export interface AdminFinalExamUser {
  unlocked: boolean;
  remainingTopics: number;
  types: {
    type: FinalExamType;
    questions: number;
    minutes: number;
    maxAttempts: number;
    attemptsUsed: number;
    average: number | null;
    attempts: AttemptSummary[];
    archivedCount: number;
    certificate: { certificateNumber: string; averagePercent: number; issuedAt: string; fullName: string } | null;
  }[];
}

export const FINAL_STATUS: Record<AttemptSummary["status"], { label: string; tone: "success" | "danger" | "warning" }> = {
  FINISHED: { label: "Yakunlangan", tone: "success" },
  EXPIRED: { label: "Vaqt tugagan", tone: "danger" },
  IN_PROGRESS: { label: "Jarayonda", tone: "warning" },
};

/** Foydalanuvchi sahifasi: yakuniy imtihon urinishlari, o'rtacha, sertifikat va "nolga qaytarish". */
export function UserFinalExamPanel({ userId }: { userId: string }) {
  const [data, setData] = useState<AdminFinalExamUser | null>(null);
  const [confirming, setConfirming] = useState<FinalExamType | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminFetch<AdminFinalExamUser>(`final-exam/users/${userId}`)
      .then(setData)
      .catch(() => setData({ unlocked: false, remainingTopics: 0, types: [] }));
  }, [userId]);

  useEffect(() => {
     
    load();
  }, [load]);

  async function reset(type: FinalExamType) {
    setBusy(true);
    try {
      const res = await adminFetch<{ archived: number }>(`final-exam/users/${userId}/reset`, { json: { type } });
      showToast({ tone: "success", message: `${EXAM_TYPE_LABEL[type]}: ${res.archived} ta urinish nolga qaytarildi` });
      setConfirming(null);
      load();
    } catch (err) {
      showToast({ tone: "danger", message: err instanceof Error ? err.message : "Bajarib bo'lmadi" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Yakuniy ichki imtihon" className="mb-6">
      {!data ? (
        <LoadingBlock />
      ) : (
        <div className="flex flex-col gap-5" data-testid="user-final-exam">
          <p className="text-sm text-muted-foreground">
            {data.unlocked ? "Imtihon ochiq (1–6-kun mavzulari tugagan)." : `Imtihon yopiq — ${data.remainingTopics} ta mavzu tugatilmagan.`}
          </p>
          {data.types.map((t) => (
            <div key={t.type} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{EXAM_TYPE_LABEL[t.type]}</span>
                  <Badge tone="muted">
                    {t.attemptsUsed}/{t.maxAttempts} urinish
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    o&apos;rtacha: <b className="text-foreground">{t.average !== null ? formatPercent(t.average) : "—"}</b>
                  </span>
                  {t.certificate ? (
                    <Badge tone="success">Sertifikat {t.certificate.certificateNumber}</Badge>
                  ) : t.attemptsUsed >= t.maxAttempts ? (
                    <Badge tone="warning">O&apos;tmadi</Badge>
                  ) : null}
                  {t.archivedCount > 0 && <span className="text-xs text-muted-foreground">arxivda: {t.archivedCount}</span>}
                </div>
                {t.attemptsUsed > 0 &&
                  (confirming === t.type ? (
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm" disabled={busy} onClick={() => reset(t.type)} data-testid={`final-reset-confirm-${t.type}`}>
                        Ha, nolga qaytarish
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setConfirming(null)}>
                        Bekor
                      </Button>
                    </div>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setConfirming(t.type)} data-testid={`final-reset-${t.type}`}>
                      Urinishlarni nolga qaytarish
                    </Button>
                  ))}
              </div>
              {confirming === t.type && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Urinishlar arxivlanadi (tarix saqlanadi) va o&apos;quvchi yana 10 ta urinish oladi. Berilgan sertifikat o&apos;zgarmaydi.
                </p>
              )}
              {t.attempts.length === 0 ? (
                <EmptyState>Hali topshirmagan</EmptyState>
              ) : (
                <div className="mt-3">
                  <Table>
                    <thead>
                      <tr>
                        <Th>#</Th>
                        <Th>Boshlangan</Th>
                        <Th>To&apos;g&apos;ri</Th>
                        <Th>Foiz</Th>
                        <Th>Holat</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.attempts.map((a, i) => (
                        <tr key={a.id} data-testid="admin-final-row">
                          <Td className="font-mono">{i + 1}</Td>
                          <Td className="whitespace-nowrap">{formatDateTime(a.startedAt)}</Td>
                          <Td className="font-mono whitespace-nowrap">{a.correct !== null ? `${a.correct}/${a.total}` : `${a.answered}/${a.total} javob`}</Td>
                          <Td className="font-mono font-semibold">{a.percent !== null ? formatPercent(a.percent) : "—"}</Td>
                          <Td>
                            <Badge tone={FINAL_STATUS[a.status].tone}>{FINAL_STATUS[a.status].label}</Badge>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
