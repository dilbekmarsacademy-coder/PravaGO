"use client";

import { useSyncExternalStore } from "react";
import { LaptopIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import { Card } from "@/components/shared/Card";

const noopSubscribe = () => () => {};

function getUserAgentSnapshot(): string {
  return navigator.userAgent;
}

function getServerUserAgentSnapshot(): string {
  return "";
}

function useUserAgent(): string {
  return useSyncExternalStore(noopSubscribe, getUserAgentSnapshot, getServerUserAgentSnapshot);
}

function classifyDevice(ua: string, labels: Dictionary["kabinet"]["device"]) {
  if (!ua) return { label: labels.detecting, Icon: LaptopIcon };
  if (/iPad|Tablet/i.test(ua)) return { label: labels.tablet, Icon: TabletIcon };
  if (/Mobi|iPhone|Android.*Mobile/i.test(ua)) return { label: labels.mobile, Icon: SmartphoneIcon };
  return { label: labels.desktop, Icon: LaptopIcon };
}

export default function DeviceInfo() {
  const ua = useUserAgent();
  const { t } = useLocale();
  const labels = t.kabinet.device;
  const { label, Icon } = classifyDevice(ua, labels);

  return (
    <Card className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-info">
          <Icon className="size-4.5" />
        </span>
        <div>
          <p className="font-display text-sm font-bold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{labels.current}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground sm:ml-auto sm:max-w-[14rem] sm:text-right">
        {labels.singleDevice}
      </p>
    </Card>
  );
}
