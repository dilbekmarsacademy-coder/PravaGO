"use client";

import { PageHeader, Panel } from "@/components/admin/ui";

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader title="Statistika" />
      <Panel>
        <p className="text-sm text-muted-foreground">Statistika bo&apos;limi tayyorlanmoqda.</p>
      </Panel>
    </>
  );
}
