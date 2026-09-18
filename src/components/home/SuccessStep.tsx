import { DialogTitle } from "@/components/ui/dialog";

export default function SuccessStep() {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="flex size-24 rotate-[-8deg] items-center justify-center rounded-full border-4 border-stop">
        <span className="font-display text-sm uppercase leading-tight tracking-[0.1em] text-stop">
          Tasdiqlandi
        </span>
      </div>

      <div>
        <DialogTitle className="font-display text-3xl uppercase tracking-wide text-ink">
          Muvaffaqiyatli yakunlandi
        </DialogTitle>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink/70">
          Ro&rsquo;yxatdan o&rsquo;tish muvaffaqiyatli yakunlandi (demo rejim).
        </p>
      </div>
    </div>
  );
}
