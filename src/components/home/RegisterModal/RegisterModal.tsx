"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import OfferStep from "./OfferStep";
import StatusStep from "./StatusStep";
import FormStep from "./FormStep";
import OtpStep from "./OtpStep";
import SuccessStep from "./SuccessStep";
import type { ExamStatus, ModalStep, RegisterFormData } from "../types";

interface RegisterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examStatus: ExamStatus | null;
}

const INITIAL_FORM_DATA: RegisterFormData = {
  firstName: "",
  lastName: "",
  age: "",
  phone: "",
  examStatus: null,
};

export default function RegisterModal({
  open,
  onOpenChange,
  examStatus,
}: RegisterModalProps) {
  const [step, setStep] = useState<ModalStep>("offer");
  const [formData, setFormData] = useState<RegisterFormData>(INITIAL_FORM_DATA);

  // "Siz qaysi holatdasiz?" kartalari orqali holat allaqachon tanlangan bo'lsa
  // (ExamStatus prop), modal ichida bu savol qayta so'ralmaydi — aks holda
  // (masalan header/hero'dagi umumiy tugmalar orqali kirilganda) alohida
  // bosqich sifatida so'raladi.
  const needsStatusStep = examStatus === null;
  const stepOrder: ModalStep[] = needsStatusStep
    ? ["offer", "status", "form", "otp"]
    : ["offer", "form", "otp"];
  const stepLabel = `${stepOrder.indexOf(step) + 1}-qadam / ${stepOrder.length}`;

  function handleOpenChangeComplete(isOpen: boolean) {
    if (!isOpen) {
      setStep("offer");
      setFormData(INITIAL_FORM_DATA);
    }
  }

  function handleOfferAccept() {
    if (needsStatusStep) {
      setStep("status");
    } else {
      setFormData((prev) => ({ ...prev, examStatus }));
      setStep("form");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] w-[calc(100%-2rem)] max-w-md gap-0 overflow-y-auto rounded-2xl border border-border bg-[#0d1117]/90 p-0 text-card-foreground shadow-[0_25px_70px_-20px_rgba(0,0,0,0.75)] backdrop-blur-2xl sm:max-w-md"
      >
        <DialogClose
          render={
            <button
              type="button"
              className="absolute top-4 right-4 z-10 flex size-8 items-center justify-center rounded-full border border-border bg-background/50 text-muted-foreground transition-colors hover:border-neon-orange/50 hover:text-neon-orange"
            />
          }
        >
          <XIcon className="size-4" />
          <span className="sr-only">Yopish</span>
        </DialogClose>

        <div
          key={step}
          className="animate-in fade-in slide-in-from-right-4 p-6 duration-300 sm:p-8"
        >
          {step === "offer" && (
            <OfferStep stepLabel={stepLabel} onAccept={handleOfferAccept} />
          )}
          {step === "status" && (
            <StatusStep
              stepLabel={stepLabel}
              initialValue={formData.examStatus}
              onSubmit={(status) => {
                setFormData((prev) => ({ ...prev, examStatus: status }));
                setStep("form");
              }}
            />
          )}
          {step === "form" && (
            <FormStep
              stepLabel={stepLabel}
              initialData={formData}
              onSubmit={(data) => {
                setFormData(data);
                setStep("otp");
              }}
            />
          )}
          {step === "otp" && (
            <OtpStep
              stepLabel={stepLabel}
              phone={formData.phone}
              onVerified={() => setStep("success")}
            />
          )}
          {step === "success" && <SuccessStep />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
