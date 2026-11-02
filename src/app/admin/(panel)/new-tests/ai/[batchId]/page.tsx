"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import ImportBatchView from "@/components/admin/new-tests/ImportBatchView";

export default function AdminAiImportPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params);
  return (
    <>
      <Link href="/admin/new-tests?mode=ai" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Yangi testlar
      </Link>
      <ImportBatchView batchId={batchId} />
    </>
  );
}
