"use client";

import { useEffect, useState } from "react";
import ManualTestsPanel from "@/components/admin/new-tests/ManualTestsPanel";
import AiImportPanel from "@/components/admin/new-tests/AiImportPanel";
import { PageHeader, Tabs } from "@/components/admin/ui";

type Mode = "manual" | "ai";

export default function AdminNewTestsPage() {
  const [mode, setMode] = useState<Mode>("manual");

  // Tanlangan usul manzilda (?mode=ai) — sahifa yangilansa ham saqlanadi.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (new URLSearchParams(window.location.search).get("mode") === "ai") setMode("ai");
  }, []);

  function change(next: Mode) {
    setMode(next);
    const url = new URL(window.location.href);
    if (next === "ai") url.searchParams.set("mode", "ai");
    else url.searchParams.delete("mode");
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <PageHeader title="Yangi testlar" subtitle="To'plamlar → testlar. Kabinetda to'lov qilganlarga ko'rinadi (faqat nashr qilinganlari)." />
      <Tabs
        className="mb-5"
        value={mode}
        onChange={change}
        options={[
          { value: "manual", label: "Qo'lda qo'shish" },
          { value: "ai", label: "AI bilan fayllardan qo'shish" },
        ]}
      />
      {mode === "manual" ? <ManualTestsPanel /> : <AiImportPanel />}
    </>
  );
}
