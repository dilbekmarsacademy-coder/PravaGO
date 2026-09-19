"use client";

import { motion } from "framer-motion";
import { RocketIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import HeroBackground from "./HeroBackground";

interface HeroProps {
  onStart: () => void;
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

export default function Hero({ onStart }: HeroProps) {
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
            Revolyutsion haydovchilik platformasi
          </span>
        </motion.div>

        <motion.h1
          variants={item}
          className="mt-6 max-w-3xl font-display text-4xl leading-[1.08] font-extrabold tracking-tight text-foreground sm:text-6xl"
        >
          Prava imtihonini{" "}
          <span className="text-gradient-speed">1-urinishdayoq</span> topshiring!
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          63 ta bilet, 1 260 ta interaktiv savol va 7 kunlik avtotest
          simulyatsiyasi — tizimli tayyorgarlik uchun barchasi bitta joyda.
        </motion.p>

        <motion.div
          variants={item}
          className="mt-9 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Button
            onClick={onStart}
            className="glow-orange-hover h-auto rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-7 py-3.5 text-base font-bold text-background"
          >
            Tayyorlanishni boshlash
            <RocketIcon className="size-4" />
          </Button>
          <a
            href="#qanday-ishlaydi"
            className="rounded-full border border-border px-7 py-3.5 text-base font-medium text-foreground/90 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
          >
            Qanday ishlashini ko&rsquo;rish
          </a>
        </motion.div>

        <motion.p
          variants={item}
          className="mt-5 font-mono text-xs tracking-wide text-muted-foreground"
        >
          Ro&rsquo;yxatdan o&rsquo;tish 1 daqiqadan kam vaqt oladi
        </motion.p>
      </motion.div>
    </section>
  );
}
