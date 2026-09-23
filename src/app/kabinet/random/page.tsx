import Link from "next/link";
import { ArrowLeftIcon, ShuffleIcon } from "lucide-react";

interface RandomPageProps {
  searchParams: Promise<{ size?: string }>;
}

export default async function RandomTestPage({ searchParams }: RandomPageProps) {
  const { size } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10 text-center sm:px-8">
      <div className="glass flex max-w-md flex-col items-center gap-4 rounded-2xl p-10">
        <span className="flex size-14 items-center justify-center rounded-full bg-foreground/5 text-neon-cyan">
          <ShuffleIcon className="size-6" />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">
            {size ? `${size} talik tasodifiy test` : "Tasodifiy test"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Bu sahifa tez orada ishga tushadi. Natijalar o&rsquo;quv progressiga ta&rsquo;sir
            qilmaydi.
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
