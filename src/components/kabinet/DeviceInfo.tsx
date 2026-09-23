"use client";

import { useSyncExternalStore } from "react";
import { LaptopIcon, SmartphoneIcon, TabletIcon } from "lucide-react";

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

function classifyDevice(ua: string) {
  if (!ua) return { label: "Aniqlanmoqda...", Icon: LaptopIcon };
  if (/iPad|Tablet/i.test(ua)) return { label: "Planshet", Icon: TabletIcon };
  if (/Mobi|iPhone|Android.*Mobile/i.test(ua)) return { label: "Mobil telefon", Icon: SmartphoneIcon };
  return { label: "Kompyuter", Icon: LaptopIcon };
}

export default function DeviceInfo() {
  const ua = useUserAgent();
  const { label, Icon } = classifyDevice(ua);

  return (
    <div className="glass flex flex-col items-start gap-3 rounded-2xl p-5 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-neon-cyan">
          <Icon className="size-4.5" />
        </span>
        <div>
          <p className="font-display text-sm font-bold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">Joriy qurilma &middot; hozir faol</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground sm:ml-auto sm:max-w-[14rem] sm:text-right">
        Bitta vaqtda faqat bitta qurilmada kirish mumkin.
      </p>
    </div>
  );
}
