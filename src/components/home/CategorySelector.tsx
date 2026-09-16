import RetroButton from "@/components/ui/RetroButton";
import StampBadge from "@/components/ui/StampBadge";
import StepShell from "./StepShell";
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
    <StepShell
      title="Toifangizni tanlang"
      subtitle="Sizga mos dastur shu tanlovga qarab moslashtiriladi"
    >
      <div className="flex flex-col gap-4">
        {CATEGORIES.map((cat) => {
          const isSelected = selected === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={`relative overflow-hidden border-[3px] px-5 py-5 text-left font-body text-lg transition-all duration-100 ${
                isSelected
                  ? "border-asphalt bg-paper text-ink shadow-[4px_4px_0_0_#C6402C]"
                  : "border-paper-dark/50 bg-asphalt-light text-paper hover:border-signal-yellow"
              }`}
            >
              {cat.label}
              {isSelected && (
                <StampBadge
                  color="red"
                  className="absolute -top-2 -right-2 text-[10px]"
                >
                  Tanlandi
                </StampBadge>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center">
        <RetroButton onClick={onNext} disabled={!selected}>
          Davom etish
        </RetroButton>
      </div>
    </StepShell>
  );
}
