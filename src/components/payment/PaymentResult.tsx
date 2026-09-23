"use client";

import { useEffect, useState } from "react";
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const REDIRECT_SECONDS = 3;

interface PaymentResultProps {
  status: "loading" | "success" | "error";
  loadingText: string;
  onRetry: () => void;
  onRedirect: () => void;
}

export default function PaymentResult({
  status,
  loadingText,
  onRetry,
  onRedirect,
}: PaymentResultProps) {
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (status !== "success") return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    const timeout = setTimeout(onRedirect, REDIRECT_SECONDS * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status === "loading") {
    return (
      <div className="glass flex flex-col items-center gap-4 rounded-2xl p-10 text-center">
        <Loader2Icon className="size-8 animate-spin text-neon-orange" />
        <p className="text-sm text-muted-foreground">{loadingText}</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="glass flex flex-col items-center gap-4 rounded-2xl p-10 text-center">
        <span className="glow-orange flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 text-background">
          <CheckIcon className="size-7" strokeWidth={2.5} />
        </span>
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">
            To&rsquo;lov muvaffaqiyatli amalga oshirildi!
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Akkauntingiz faollashtirildi. Kabinetga yo&rsquo;naltirilmoqda
            {secondsLeft > 0 ? ` (${secondsLeft})` : ""}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass flex flex-col items-center gap-4 rounded-2xl p-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-neon-red/15 text-neon-red">
        <XIcon className="size-7" strokeWidth={2.5} />
      </span>
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">
          To&rsquo;lov amalga oshmadi
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Qayta urinib ko&rsquo;ring yoki boshqa to&rsquo;lov usulini tanlang.
        </p>
      </div>
      <Button
        type="button"
        onClick={onRetry}
        className="glow-orange-hover mt-2 h-auto rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 py-2.5 text-sm font-bold text-background"
      >
        Qayta urinish
      </Button>
    </div>
  );
}
