"use client";

import { useState } from "react";
import RetroButton from "@/components/ui/RetroButton";
import Hero from "./Hero";
import HiddenVideoPlayer from "./HiddenVideoPlayer";
import GuideSection from "./GuideSection";
import CategorySelector from "./CategorySelector";
import RegisterForm from "./RegisterForm";
import OtpVerify from "./OtpVerify";
import PaymentPlaceholder from "./PaymentPlaceholder";
import Footer from "./Footer";
import StepShell from "./StepShell";
import StepProgress from "./StepProgress";
import { CategoryId, RegisterFormData, Step } from "./types";

const SAMPLE_VIDEO_ID = "phsjXvkA51s";

export default function HomePage() {
  const [step, setStep] = useState<Step>("hero");
  const [videoEnded, setVideoEnded] = useState(false);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [registerData, setRegisterData] = useState<RegisterFormData | null>(
    null,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col justify-center px-4 py-6 sm:px-6">
        {step !== "hero" && (
          <div className="mx-auto w-full max-w-2xl">
            <StepProgress step={step} />
          </div>
        )}

        {step === "hero" && <Hero onStart={() => setStep("video")} />}

        {step === "video" && (
          <StepShell
            title="Bepul namunaviy video"
            subtitle="Darsni oxirigacha tomosha qiling — davom etish tugmasi shundan so'ng faollashadi"
          >
            <HiddenVideoPlayer
              videoId={SAMPLE_VIDEO_ID}
              onEnded={() => setVideoEnded(true)}
            />
            <div className="mt-8 flex justify-center">
              <RetroButton
                onClick={() => setStep("guide")}
                disabled={!videoEnded}
              >
                Davom etish
              </RetroButton>
            </div>
          </StepShell>
        )}

        {step === "guide" && (
          <GuideSection onNext={() => setStep("category")} />
        )}

        {step === "category" && (
          <CategorySelector
            selected={category}
            onSelect={setCategory}
            onNext={() => setStep("register")}
          />
        )}

        {step === "register" && (
          <RegisterForm
            onNext={(data) => {
              setRegisterData(data);
              setStep("otp");
            }}
          />
        )}

        {step === "otp" && (
          <OtpVerify
            phone={registerData?.phone ?? ""}
            onVerified={() => setStep("payment")}
          />
        )}

        {step === "payment" && <PaymentPlaceholder />}
      </main>

      <Footer />
    </div>
  );
}
