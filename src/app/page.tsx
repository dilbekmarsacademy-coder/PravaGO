import Hero from "@/components/home/Hero";
import TrustBadges from "@/components/home/TrustBadges";
import RegisterModal from "@/components/home/RegisterModal";

export default function Page() {
  return (
    <main className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-10 px-5 py-16 sm:gap-12 sm:px-8">
      <Hero />
      <TrustBadges />
      <RegisterModal />
    </main>
  );
}
