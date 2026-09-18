export default function Hero() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="inline-flex items-center gap-2 border-2 border-paper/70 px-3 py-1.5">
        <span className="size-2 rounded-full bg-stop" />
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-paper/90">
          PravaTayyor
        </span>
      </div>

      <h1 className="max-w-3xl font-display text-5xl leading-[0.95] tracking-wide text-paper uppercase sm:text-7xl">
        Pravaga birinchi urinishda tayyor bo&rsquo;ling
      </h1>

      <p className="max-w-xl text-balance text-base leading-relaxed text-paper/75 sm:text-lg">
        Video darsliklar, to&rsquo;liq bilet banki va 98% tayyorgarlik talabiga
        asoslangan 6+1 kunlik dastur — barchasi bitta joyda.
      </p>
    </div>
  );
}
