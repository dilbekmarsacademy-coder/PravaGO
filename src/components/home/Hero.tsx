import RetroButton from "@/components/ui/RetroButton";
import StampBadge from "@/components/ui/StampBadge";

interface HeroProps {
  onStart: () => void;
}

export default function Hero({ onStart }: HeroProps) {
  return (
    <section className="bg-halftone flex min-h-[calc(100dvh-2rem)] flex-col items-center justify-center rounded-none border-[3px] border-paper-dark/40 px-4 py-16 text-center sm:px-8">
      <StampBadge color="yellow" className="mb-6">
        Rasmiy tayyorgarlik dasturi
      </StampBadge>

      <h1 className="font-display text-6xl leading-[0.95] tracking-wide text-paper uppercase sm:text-8xl">
        Prava<span className="text-signal-yellow">Tayyor</span>
      </h1>

      <div className="my-6 h-1 w-24 bg-signal-red" />

      <p className="max-w-md font-body text-base text-paper/85 sm:max-w-lg sm:text-lg">
        Haydovchilik guvohnomasi nazariy imtihoniga respublika miqyosida
        tayyorlaydigan onlayn platforma. Video darslar, kalit so&apos;zlar va
        haqiqiy test topshiriqlari — barchasi bitta joyda.
      </p>

      <p className="mt-4 max-w-md font-mono text-xs tracking-wide text-paper/60 uppercase sm:text-sm">
        6 kunlik tayyorgarlik + 7-kun yakuniy imtihon
      </p>

      <RetroButton onClick={onStart} className="mt-10">
        Boshlash
      </RetroButton>
    </section>
  );
}
