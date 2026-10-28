"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  BookOpenCheckIcon,
  GaugeIcon,
  HistoryIcon,
  LogOutIcon,
  MenuIcon,
  SettingsIcon,
  SparklesIcon,
  SquarePlusIcon,
  UsersIcon,
  WalletIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { adminFetch } from "@/lib/admin/api";
import ThemeToggle from "@/components/shared/ThemeToggle";

export interface AdminProfile {
  id: string;
  name: string;
  login: string;
  role: "OWNER" | "DEVELOPER";
  lastLoginAt: string | null;
}

const NAV = [
  { href: "/admin/dashboard", label: "Statistika", icon: BarChart3Icon },
  { href: "/admin/users", label: "Foydalanuvchilar", icon: UsersIcon },
  { href: "/admin/payments", label: "To'lovlar", icon: WalletIcon },
  { href: "/admin/content", label: "Kontent", icon: BookOpenCheckIcon },
  { href: "/admin/new-tests", label: "Yangi testlar", icon: SquarePlusIcon },
  { href: "/admin/ai", label: "AI tahlil", icon: SparklesIcon },
  { href: "/admin/history", label: "Tarix", icon: HistoryIcon },
  { href: "/admin/settings", label: "Sozlamalar", icon: SettingsIcon },
];

const ROLE_LABEL = { OWNER: "Sayt egasi", DEVELOPER: "Dasturchi" } as const;

const AdminContext = createContext<AdminProfile | null>(null);
export function useAdmin(): AdminProfile | null {
  return useContext(AdminContext);
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    adminFetch<AdminProfile>("auth/me").then(setProfile).catch(() => undefined);
  }, []);

  async function logout() {
    try {
      await adminFetch("auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/admin/login";
    }
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-brand/15 text-brand" : "text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            <Icon className="size-4.5 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
      {profile && (
        <div className="px-1 text-sm">
          <p className="font-semibold text-foreground">{profile.name}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {profile.login} · {ROLE_LABEL[profile.role]}
          </p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={logout}
          className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <LogOutIcon className="size-4" /> Chiqish
        </button>
        <ThemeToggle />
      </div>
    </div>
  );

  const brand = (
    <Link href="/admin/dashboard" className="flex items-center gap-2.5">
      <span className="glow-orange flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 text-background">
        <GaugeIcon className="size-4.5" strokeWidth={2.4} />
      </span>
      <span className="font-display text-sm font-bold tracking-wide text-foreground uppercase">
        PravaTayyor <span className="text-brand">admin</span>
      </span>
    </Link>
  );

  return (
    <AdminContext.Provider value={profile}>
      <div className="flex min-h-screen w-full">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-border p-5 lg:flex">
          {brand}
          {nav}
          {footer}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
            {brand}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex size-10 items-center justify-center rounded-full border border-border"
              aria-label="Menyu"
            >
              <MenuIcon className="size-5" />
            </button>
          </header>

          {open && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button type="button" className="absolute inset-0 bg-black/60" aria-label="Yopish" onClick={() => setOpen(false)} />
              <aside className="absolute top-0 right-0 flex h-full w-72 max-w-[85vw] flex-col gap-6 border-l border-border bg-popover p-5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold uppercase">Menyu</span>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Yopish" className="flex size-9 items-center justify-center rounded-full border border-border">
                    <XIcon className="size-4" />
                  </button>
                </div>
                {nav}
                {footer}
              </aside>
            </div>
          )}

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
