"use client";

import { useEffect, useState } from "react";
import CenterStudentsTab from "@/components/admin/users/CenterStudentsTab";
import SelfUsersTab from "@/components/admin/users/SelfUsersTab";
import { PageHeader, Tabs } from "@/components/admin/ui";

type Tab = "center" | "self";

export default function AdminUsersPage() {
  const [tab, setTab] = useState<Tab>("center");

  // Tanlangan tab manzilda (?tab=self) — sahifa yangilansa ham saqlanadi.
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (value === "self") setTab("self");
  }, []);

  function change(next: Tab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "self") url.searchParams.set("tab", "self");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <PageHeader title="Foydalanuvchilar" subtitle="Markaz o'quvchilari va o'zi ro'yxatdan o'tganlar — progress, kirish va to'lov holati" />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={change}
        options={[
          { value: "center", label: "Shu yerda o'qiydiganlar" },
          { value: "self", label: "Yangi foydalanuvchilar" },
        ]}
      />
      {tab === "center" ? <CenterStudentsTab /> : <SelfUsersTab />}
    </>
  );
}
