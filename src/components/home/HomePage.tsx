"use client";

import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import HeroVideoSection from "./HeroVideoSection";
import GuideSection from "./GuideSection";
import CategorySelector from "./CategorySelector";
import RegisterForm from "./RegisterForm";
import OtpVerify from "./OtpVerify";
import PaymentPlaceholder from "./PaymentPlaceholder";
import Footer from "./Footer";
import RevealSection from "./RevealSection";
import { CategoryId, RegisterFormData } from "./types";

const SECTION_ORDER = [
  "guide",
  "category",
  "register",
  "otp",
  "payment",
] as const;

export default function HomePage() {
  const [videoEnded, setVideoEnded] = useState(false);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [registerData, setRegisterData] = useState<RegisterFormData | null>(
    null,
  );

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (unlockedCount === 0) return;
    const key = SECTION_ORDER[unlockedCount - 1];
    const timeout = setTimeout(() => {
      sectionRefs.current[key]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
    return () => clearTimeout(timeout);
  }, [unlockedCount]);

  const progressPercent = (unlockedCount / SECTION_ORDER.length) * 100;

  return (
    <div className="flex min-h-screen flex-col">
      <Progress
        value={progressPercent}
        className="fixed inset-x-0 top-0 z-50 h-[3px] [&_[data-slot=progress-indicator]]:rounded-none [&_[data-slot=progress-track]]:h-[3px] [&_[data-slot=progress-track]]:w-full [&_[data-slot=progress-track]]:rounded-none"
      />

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/90 px-5 py-4 backdrop-blur-sm sm:px-8">
        <span className="font-display text-sm font-semibold tracking-wide text-foreground uppercase">
          PravaTayyor
        </span>
        <span className="font-mono text-xs text-muted-foreground uppercase">
          Bosqich {Math.min(unlockedCount + 1, SECTION_ORDER.length + 1)}/
          {SECTION_ORDER.length + 1}
        </span>
      </header>

      <main className="flex flex-1 flex-col">
        <HeroVideoSection
          videoEnded={videoEnded}
          onVideoEnded={() => setVideoEnded(true)}
          onContinue={() => setUnlockedCount((c) => Math.max(c, 1))}
        />

        {unlockedCount >= 1 && (
          <RevealSection ref={(el) => { sectionRefs.current.guide = el; }}>
            <GuideSection
              onNext={() => setUnlockedCount((c) => Math.max(c, 2))}
            />
          </RevealSection>
        )}

        {unlockedCount >= 2 && (
          <RevealSection ref={(el) => { sectionRefs.current.category = el; }}>
            <CategorySelector
              selected={category}
              onSelect={setCategory}
              onNext={() => setUnlockedCount((c) => Math.max(c, 3))}
            />
          </RevealSection>
        )}

        {unlockedCount >= 3 && (
          <RevealSection ref={(el) => { sectionRefs.current.register = el; }}>
            <RegisterForm
              onNext={(data) => {
                setRegisterData(data);
                setUnlockedCount((c) => Math.max(c, 4));
              }}
            />
          </RevealSection>
        )}

        {unlockedCount >= 4 && (
          <RevealSection ref={(el) => { sectionRefs.current.otp = el; }}>
            <OtpVerify
              phone={registerData?.phone ?? ""}
              onVerified={() => setUnlockedCount((c) => Math.max(c, 5))}
            />
          </RevealSection>
        )}

        {unlockedCount >= 5 && (
          <RevealSection ref={(el) => { sectionRefs.current.payment = el; }}>
            <PaymentPlaceholder />
          </RevealSection>
        )}
      </main>

      <Footer />
    </div>
  );
}
