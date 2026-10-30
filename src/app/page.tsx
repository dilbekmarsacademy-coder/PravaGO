"use client";

import { useEffect, useState } from "react";
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
import CenterLoginModal from "@/components/home/CenterLoginModal";
import { takeKickReason, type KickReason } from "@/lib/api/session";
import type { ExamStatus } from "@/components/home/types";

export default function Page() {
  const [modalOpen, setModalOpen] = useState(false);
  const [examStatus, setExamStatus] = useState<ExamStatus | null>(null);
  const [centerOpen, setCenterOpen] = useState(false);
  const [kickReason, setKickReason] = useState<KickReason | null>(null);

  // Boshqa qurilmadan kirilgani sababli chiqarilgan markaz o'quvchisi — sabab
  // bilan birga darhol qayta kirish oynasi.
  useEffect(() => {
    const reason = takeKickReason();
    if (!reason) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKickReason(reason);
    setCenterOpen(true);
  }, []);

  function openCenterLogin() {
    setModalOpen(false);
    setCenterOpen(true);
  }

  function openRegister(status?: ExamStatus) {
    if (status) setExamStatus(status);
    setModalOpen(true);
  }

  return (
    <>
      <Header onRegisterClick={() => openRegister()} />
      <main className="relative z-10">
        <Hero onStart={() => openRegister()} onCenterLogin={openCenterLogin} />
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
        onCenterLogin={openCenterLogin}
      />
      <CenterLoginModal
        open={centerOpen}
        onOpenChange={(open) => {
          setCenterOpen(open);
          if (!open) setKickReason(null);
        }}
        notice={kickReason}
      />
    </>
  );
}
