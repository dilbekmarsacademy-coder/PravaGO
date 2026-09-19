import { GaugeIcon } from "lucide-react";

const FOOTER_LINKS = [
  { href: "#bosh-sahifa", label: "Bosh sahifa" },
  { href: "#dastur", label: "Dastur" },
  { href: "#qanday-ishlaydi", label: "Qanday ishlaydi" },
  { href: "#natijalar", label: "Natijalar" },
];

export default function Footer() {
  return (
    <footer
      id="biz-haqimizda"
      className="scroll-mt-20 border-t border-border px-5 py-12 sm:px-8"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 text-background">
            <GaugeIcon className="size-4.5" strokeWidth={2.4} />
          </span>
          <div>
            <p className="font-display text-sm font-bold tracking-wide text-foreground uppercase">
              PravaTayyor
            </p>
            <p className="text-xs text-muted-foreground">
              Onlayn haydovchilik imtihoniga tayyorgarlik platformasi
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-neon-cyan"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <p className="mt-8 text-center font-mono text-xs text-muted-foreground/70">
        © 2026 PravaTayyor. Barcha huquqlar himoyalangan.
      </p>
    </footer>
  );
}
