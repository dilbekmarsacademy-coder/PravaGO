import { Button } from "@/components/ui/button";
import Section from "./Section";

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
    <Section
      index="02"
      title="Qanday ishlaydi"
      subtitle="Platforma quyidagi tartibda ishlaydi"
      tone="soft"
    >
      <ol className="divide-y divide-border border-y border-border">
        {STEPS.map((text, i) => (
          <li key={text} className="flex items-center gap-6 py-4">
            <span className="font-mono text-xs text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-foreground">{text}</span>
          </li>
        ))}
      </ol>

      <p className="mt-6 font-mono text-xs tracking-wide text-muted-foreground uppercase">
        6 kunlik tayyorgarlik + 7-kun yakuniy imtihon
      </p>

      <Button onClick={onNext} className="mt-10">
        Davom etish
      </Button>
    </Section>
  );
}
