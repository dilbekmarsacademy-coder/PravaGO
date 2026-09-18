"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import RetroButton from "./RetroButton";
import OfferStep from "./OfferStep";
import StatusStep from "./StatusStep";
import RegisterFormStep from "./RegisterFormStep";
import OtpStep from "./OtpStep";
import SuccessStep from "./SuccessStep";
import type { ModalStep, RegisterFormData } from "./types";

const INITIAL_FORM_DATA: RegisterFormData = {
  firstName: "",
  lastName: "",
  age: "",
  phone: "",
  examStatus: null,
};

export default function RegisterModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>("offer");
  const [formData, setFormData] = useState<RegisterFormData>(
    INITIAL_FORM_DATA,
  );

  function handleOpenChange(next: boolean) {
    setOpen(next);
  }

  function handleOpenChangeComplete(isOpen: boolean) {
    if (!isOpen) {
      setStep("offer");
      setFormData(INITIAL_FORM_DATA);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
    >
      <DialogTrigger
        render={
          <RetroButton surface="dark" className="text-xl sm:text-2xl" />
        }
      >
        Ro&rsquo;yxatdan o&rsquo;tish
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] w-[calc(100%-2rem)] max-w-md gap-0 overflow-y-auto rounded-sm border-[3px] border-ink bg-card p-0 text-card-foreground shadow-[8px_8px_0_0_var(--ink)] sm:max-w-md"
      >
        <DialogClose
          render={
            <button
              type="button"
              className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center border-2 border-ink/70 bg-card text-ink transition-colors hover:bg-ink hover:text-card"
            />
          }
        >
          <XIcon className="size-4" />
          <span className="sr-only">Yopish</span>
        </DialogClose>

        <div key={step} className="animate-in fade-in slide-in-from-right-4 p-6 duration-300 sm:p-8">
          {step === "offer" && (
            <OfferStep onAccept={() => setStep("status")} />
          )}
          {step === "status" && (
            <StatusStep
              initialValue={formData.examStatus}
              onSubmit={(examStatus) => {
                setFormData((prev) => ({ ...prev, examStatus }));
                setStep("form");
              }}
            />
          )}
          {step === "form" && (
            <RegisterFormStep
              initialData={formData}
              onSubmit={(data) => {
                setFormData(data);
                setStep("otp");
              }}
            />
          )}
          {step === "otp" && (
            <OtpStep
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
