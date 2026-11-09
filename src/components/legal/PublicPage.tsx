import type { ReactNode } from "react";
import { jsonLdHtml } from "@/lib/json-ld";
import PublicHeader from "./PublicHeader";
import SiteFooter from "./SiteFooter";

// Ommaviy ma'lumot sahifalari (tariflar, oferta, qaytarish, maxfiylik, aloqa)
// uchun umumiy qobiq: sarlavha, sahifa nomi, kontent, footer va JSON-LD.
// Matnlar faqat o'zbek (lotin) tilida.

export function PublicPage({
  eyebrow,
  title,
  lead,
  updated,
  jsonLd,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  /** "Oxirgi yangilanish" sanasi (hujjatlar uchun), masalan "2026-yil 9-noyabr". */
  updated?: string;
  jsonLd?: unknown;
  children: ReactNode;
}) {
  return (
    <>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} /> : null}
      <PublicHeader />
      <main className="relative z-10 flex-1 px-4 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-5xl">
          <span className="font-mono text-xs tracking-[0.24em] text-neon-orange uppercase">{eyebrow}</span>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          {lead && <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">{lead}</p>}
          {updated && <p className="mt-2 text-xs text-muted-foreground">Oxirgi yangilanish: {updated}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

/** Hujjat bo'limi: raqamli sarlavha va matn. */
export function DocSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border py-6 first:border-t-0 first:pt-0">
      <h2 className="font-display text-lg font-bold text-foreground sm:text-xl">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[0.95rem] leading-relaxed text-foreground/85 [&_a]:font-medium [&_a]:text-neon-orange [&_a]:underline-offset-2 hover:[&_a]:underline [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:flex [&_ol]:flex-col [&_ol]:gap-1.5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
    </section>
  );
}

/** Hujjat kartasi (oferta, maxfiylik): o'qishga qulay kenglik. */
export function DocCard({ children }: { children: ReactNode }) {
  return <article className="glass rounded-2xl p-5 sm:p-8">{children}</article>;
}

/** Rekvizitlar jadvali: bo'sh qiymatlar ko'rsatilmaydi. */
export function RequisitesList({ rows }: { rows: [label: string, value: string | null | undefined][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]" data-testid="requisites">
      {rows
        .filter(([, value]) => Boolean(value))
        .map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium break-words text-foreground">{value}</dd>
          </div>
        ))}
    </dl>
  );
}
