interface HeroBackgroundProps {
  /**
   * Haqiqiy mashina fotosurati tanlanganda shu prop orqali osongina
   * almashtirish mumkin. Hozircha rasm tanlanmagan/litsenziyalanmagan,
   * shuning uchun CSS/SVG bilan yaratilgan neon fon ishlatiladi.
   */
  imageUrl?: string;
}

export default function HeroBackground({ imageUrl }: HeroBackgroundProps) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
        </>
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 20% -5%, rgba(255,94,0,0.22), transparent 60%), radial-gradient(ellipse 55% 45% at 85% 10%, rgba(0,229,255,0.16), transparent 60%), linear-gradient(180deg, var(--surface-1) 0%, var(--surface-2) 50%, var(--surface-1) 100%)",
            }}
          />

          {/* Neon glow blob'lar */}
          <div className="absolute -top-24 -left-20 size-72 rounded-full bg-neon-orange/25 blur-[100px]" />
          <div className="absolute top-10 -right-16 size-80 rounded-full bg-neon-cyan/20 blur-[110px]" />

          {/* Perspective road lines effect */}
          <div className="road-perspective absolute inset-x-0 bottom-0 h-64 opacity-[0.22] [mask-image:linear-gradient(to_top,black,transparent)]" />

          {/* Moshina siluetining neon chizma tasviri */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="url(#car-gradient)"
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute right-[-6%] bottom-[6%] h-auto w-[65%] max-w-[560px] opacity-[0.3] drop-shadow-[0_0_45px_rgba(255,94,0,0.3)] sm:w-[46%]"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="car-gradient" x1="0" y1="0" x2="24" y2="0">
                <stop offset="0%" stopColor="#ff5e00" />
                <stop offset="100%" stopColor="#00e5ff" />
              </linearGradient>
            </defs>
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
            <circle cx="7" cy="17" r="2" />
            <path d="M9 17h6" />
            <circle cx="17" cy="17" r="2" />
          </svg>
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
