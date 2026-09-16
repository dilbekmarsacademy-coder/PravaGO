import RetroCard from "@/components/ui/RetroCard";
import StampBadge from "@/components/ui/StampBadge";
import StepShell from "./StepShell";

export default function PaymentPlaceholder() {
  return (
    <StepShell
      title="To'lov"
      subtitle="Ro'yxatdan o'tish muvaffaqiyatli yakunlandi"
    >
      <RetroCard className="text-center">
        <StampBadge color="yellow" className="mb-5">
          Demo rejim
        </StampBadge>

        <p className="font-body text-lg text-ink">
          To&apos;lov tizimi tez orada ulanadi
        </p>
        <p className="mt-1 font-mono text-sm tracking-wide text-ink/60 uppercase">
          Click · Payme · Uzum Bank
        </p>

        <button
          type="button"
          disabled
          className="mt-7 inline-flex w-full items-center justify-center border-[3px] border-asphalt/40 bg-asphalt-lighter/10 px-6 py-3 font-display text-xl tracking-wider text-ink/40 uppercase cursor-not-allowed sm:w-auto sm:px-10"
        >
          To&apos;lovni amalga oshirish
        </button>
      </RetroCard>
    </StepShell>
  );
}
