import { CheckIcon } from "lucide-react";
import { DialogTitle } from "@/components/ui/dialog";

export default function SuccessStep() {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <span className="glow-orange flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 text-background">
        <CheckIcon className="size-7" strokeWidth={2.5} />
      </span>

      <div>
        <DialogTitle className="font-display text-2xl font-bold text-foreground">
          Muvaffaqiyatli yakunlandi
        </DialogTitle>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          Ro&rsquo;yxatdan o&rsquo;tish yakunlandi (demo rejim).
        </p>
      </div>
    </div>
  );
}
