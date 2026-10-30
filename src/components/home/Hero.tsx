"use client";

import { motion } from "framer-motion";
import { GraduationCapIcon, RocketIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/useLocale";
import HeroBackground from "./HeroBackground";

interface HeroProps {
  onStart: () => void;
  /** "Men shu yerda o'qiyman" — o'quv markaz o'quvchisi kirishi. */
  onCenterLogin: () => void;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function Hero({ onStart, onCenterLogin }: HeroProps) {
  const { t } = useLocale();

  return (
    <section
      id="bosh-sahifa"
      className="relative flex min-h-[92svh] scroll-mt-16 flex-col items-center justify-center px-5 pt-24 pb-16 text-center sm:px-8"
    >
      <HeroBackground />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center"
      >
        <motion.div
          variants={item}
          className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-neon-green opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-neon-green" />
          </span>
          <span className="font-mono text-[0.68rem] font-medium tracking-[0.22em] text-foreground/90 uppercase">
            {t.hero.badge}
          </span>
        </motion.div>

        <motion.h1
          variants={item}
          className="mt-6 max-w-3xl font-display text-4xl leading-[1.08] font-extrabold tracking-tight text-foreground sm:text-6xl"
        >
          {t.hero.titlePre}
          <span className="text-gradient-speed">{t.hero.titleHighlight}</span>
          {t.hero.titlePost}
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          {t.hero.subtitle}
        </motion.p>

        <motion.div
          variants={item}
          className="mt-9 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Button
            onClick={onStart}
            className="glow-orange-hover h-auto rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-7 py-3.5 text-base font-bold text-background"
          >
            {t.hero.ctaPrimary}
            <RocketIcon className="size-4" />
          </Button>
          <a
            href="#qanday-ishlaydi"
            className="rounded-full border border-border px-7 py-3.5 text-base font-medium text-foreground/90 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
          >
            {t.hero.ctaSecondary}
          </a>
        </motion.div>

        <motion.div variants={item} className="mt-6 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={onCenterLogin}
            data-testid="center-login-open"
            className="glass inline-flex items-center gap-2 rounded-full border border-neon-cyan/40 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-neon-cyan hover:text-neon-cyan"
          >
            <GraduationCapIcon className="size-4 text-neon-cyan" />
            {t.centerLogin.button}
          </button>
          <span className="text-xs text-muted-foreground">{t.centerLogin.buttonHint}</span>
        </motion.div>

        <motion.p
          variants={item}
          className="mt-5 font-mono text-xs tracking-wide text-muted-foreground"
        >
          {t.hero.note}
        </motion.p>
      </motion.div>
    </section>
  );
}
