import RetroButton from "@/components/ui/RetroButton";
import RetroCard from "@/components/ui/RetroCard";
import StepShell from "./StepShell";

interface GuideSectionProps {
  onNext: () => void;
}

const STEPS = [
  "Video darsni to'liq tomosha qiling",
  "Mavzuga oid kalit so'zlarni o'qib chiqing",
  "Shu mavzu bo'yicha test ishlang",
  "Kamida 98% natija ko'rsating",
  "Keyingi mavzuga o'ting",
];

export default function GuideSection({ onNext }: GuideSectionProps) {
  return (
    <StepShell
      title="Qo'llanma"
      subtitle="Platforma quyidagi tartibda ishlaydi"
    >
      <RetroCard>
        <ol className="space-y-3">
          {STEPS.map((text, i) => (
            <li key={text} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center border-[3px] border-asphalt bg-signal-yellow font-display text-lg text-asphalt">
                {i + 1}
              </span>
              <span className="pt-1 font-body text-ink">{text}</span>
            </li>
          ))}
        </ol>

        <div className="mt-6 border-t-[3px] border-dashed border-asphalt/30 pt-4">
          <p className="font-mono text-xs tracking-wide text-ink/70 uppercase">
            Dastur davomiyligi: 6 kun tayyorgarlik + 7-kun yakuniy imtihon
          </p>
        </div>
      </RetroCard>

      <div className="mt-8 flex justify-center">
        <RetroButton onClick={onNext}>Davom etish</RetroButton>
      </div>
    </StepShell>
  );
}
