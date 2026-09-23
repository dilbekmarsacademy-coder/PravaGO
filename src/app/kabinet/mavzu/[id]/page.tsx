import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ConstructionIcon } from "lucide-react";
import { MOCK_TOPICS } from "@/lib/mock/course";

interface MavzuPageProps {
  params: Promise<{ id: string }>;
}

export default async function MavzuPage({ params }: MavzuPageProps) {
  const { id } = await params;
  const topic = MOCK_TOPICS.find((t) => t.id === id);

  if (!topic) {
    notFound();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10 text-center sm:px-8">
      <div className="glass flex max-w-md flex-col items-center gap-4 rounded-2xl p-10">
        <span className="flex size-14 items-center justify-center rounded-full bg-foreground/5 text-neon-orange">
          <ConstructionIcon className="size-6" />
        </span>
        <div>
          <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            {topic.number}-mavzu
          </span>
          <h1 className="mt-1 font-display text-xl font-bold text-foreground">{topic.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Video dars, kalit so&rsquo;zlar va mavzu testi sahifasi tez orada ishga tushadi.
          </p>
        </div>
        <Link
          href="/kabinet"
          className="mt-2 inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground/90 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
        >
          <ArrowLeftIcon className="size-4" />
          Kabinetga qaytish
        </Link>
      </div>
    </main>
  );
}
