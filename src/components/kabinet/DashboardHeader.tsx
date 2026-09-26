"use client";

import { LogOutIcon } from "lucide-react";
import type { ExamStatus } from "@/components/home/types";
import { AppHeader, BrandMark } from "@/components/shared/AppHeader";
import { Badge } from "@/components/shared/Badge";
import { buttonClasses } from "@/components/shared/Button";
import { HeaderMenu, HeaderMenuItem } from "@/components/shared/HeaderMenu";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { useLocale } from "@/lib/i18n/useLocale";

interface DashboardHeaderProps {
  firstName: string;
  lastName: string;
  examStatus: ExamStatus;
  onLogout: () => void;
}

export default function DashboardHeader({ firstName, lastName, examStatus, onLogout }: DashboardHeaderProps) {
  const { t } = useLocale();
  const header = t.kabinet.header;

  return (
    <AppHeader>
      <div className="flex items-center gap-2.5">
        <BrandMark />
        <span className="hidden font-display text-sm font-bold tracking-wide text-foreground uppercase md:inline">
          {t.header.brand}
        </span>
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="min-w-0 text-right">
          <p className="truncate font-display text-sm font-bold text-foreground">
            {firstName} {lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{header.category[examStatus]}</p>
        </div>

        <Badge tone="success" className="hidden sm:inline-flex">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-success" />
          </span>
          {header.active}
        </Badge>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          <ThemeToggle className="size-10" />
          <button
            type="button"
            onClick={onLogout}
            aria-label={header.logout}
            title={header.logout}
            className={buttonClasses({
              variant: "secondary",
              size: "icon",
              className: "size-10 text-muted-foreground hover:border-danger/50 hover:text-danger",
            })}
          >
            <LogOutIcon className="size-4" />
          </button>
        </div>

        <HeaderMenu
          label={header.menu}
          className="md:hidden"
          actions={(close) => (
            <HeaderMenuItem
              tone="danger"
              icon={<LogOutIcon className="size-4" />}
              onClick={() => {
                close();
                onLogout();
              }}
            >
              {header.logout}
            </HeaderMenuItem>
          )}
        />
      </div>
    </AppHeader>
  );
}
