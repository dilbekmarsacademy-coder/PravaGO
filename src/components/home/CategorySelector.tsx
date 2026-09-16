import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Section from "./Section";
import { CategoryId } from "./types";

interface CategorySelectorProps {
  selected: CategoryId | null;
  onSelect: (id: CategoryId) => void;
  onNext: () => void;
}

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "failed_before", label: "Ilgari imtihon topshirib, yiqilgan" },
  { id: "never_taken", label: "Hali biror marta imtihon topshirmagan" },
  { id: "revoked", label: "Pravasi bekor qilingan (qayta olayotgan)" },
];

export default function CategorySelector({
  selected,
  onSelect,
  onNext,
}: CategorySelectorProps) {
  return (
    <Section
      index="03"
      title="Toifangizni tanlang"
      subtitle="Sizga mos dastur shu tanlovga qarab moslashtiriladi"
    >
      <RadioGroup
        value={selected ?? undefined}
        onValueChange={(value) => onSelect(value as CategoryId)}
        className="gap-3"
      >
        {CATEGORIES.map((cat) => {
          const isSelected = selected === cat.id;
          return (
            <div
              key={cat.id}
              className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-foreground/30"
              }`}
            >
              <RadioGroupItem value={cat.id} id={cat.id} />
              <Label
                htmlFor={cat.id}
                className="flex-1 cursor-pointer font-normal text-foreground"
              >
                {cat.label}
              </Label>
            </div>
          );
        })}
      </RadioGroup>

      <Button onClick={onNext} disabled={!selected} className="mt-10">
        Davom etish
      </Button>
    </Section>
  );
}
