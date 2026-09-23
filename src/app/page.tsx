"use client";

import { useState } from "react";
import Header from "@/components/home/Header";
import Hero from "@/components/home/Hero";
import TrustStats from "@/components/home/TrustStats";
import CategorySection from "@/components/home/CategorySection";
import HowItWorks from "@/components/home/HowItWorks";
import ProductPreview from "@/components/home/ProductPreview";
import Pricing from "@/components/home/Pricing";
import Testimonials from "@/components/home/Testimonials";
import FinalCta from "@/components/home/FinalCta";
import Footer from "@/components/home/Footer";
import RegisterModal from "@/components/home/RegisterModal/RegisterModal";
import type { ExamStatus } from "@/components/home/types";

export default function Page() {
  const [modalOpen, setModalOpen] = useState(false);
  const [examStatus, setExamStatus] = useState<ExamStatus | null>(null);

  function openRegister(status?: ExamStatus) {
    if (status) setExamStatus(status);
    setModalOpen(true);
  }

  return (
    <>
      <Header onRegisterClick={() => openRegister()} />
      <main className="relative z-10">
        <Hero onStart={() => openRegister()} />
        <TrustStats />
        <CategorySection onSelect={(status) => openRegister(status)} />
        <HowItWorks />
        <ProductPreview onStart={() => openRegister()} />
        <Pricing onStart={() => openRegister()} />
        <Testimonials />
        <FinalCta onStart={() => openRegister()} />
      </main>
      <Footer />
      <RegisterModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        examStatus={examStatus}
      />
    </>
  );
}
