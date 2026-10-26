"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Logo } from "./Logo";
import { useLang } from "@/lib/i18n";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const { t } = useLang();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const logoY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const logoRotate = useTransform(scrollYProgress, [0, 1], [0, -12]);

  return (
    <section id="top" ref={ref} className="bp-grid relative overflow-hidden pt-28 md:pt-36">
      <div className="mx-auto grid min-h-[calc(100svh-7rem)] max-w-7xl items-center gap-12 px-4 pb-16 md:grid-cols-12 md:px-8 md:pb-24">
        <div className="md:col-span-7">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="font-mono text-xs uppercase tracking-[0.22em] text-muted"
          >
            {t.hero.eyebrow}
          </motion.p>

          <h1 className="mt-6 font-display text-[clamp(3.25rem,10vw,8.5rem)] font-light uppercase leading-[1.08] tracking-[0.01em]">
            {t.hero.title.map((line, i) => (
              <span key={line} className="-mb-[0.24em] block overflow-hidden pb-[0.24em]">
                <motion.span
                  className="block"
                  initial={{ y: "105%" }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.5 + i * 0.12, duration: 1, ease }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.9, ease }}
            className="mt-8 max-w-lg text-lg leading-relaxed text-ink-soft"
          >
            {t.hero.lead}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.25, duration: 0.9, ease }}
            className="mt-10 flex flex-wrap gap-3"
          >
            <a
              href="#contact"
              className="group inline-flex items-center gap-3 rounded-full bg-ink px-7 py-4 text-sm font-medium text-surface transition-colors hover:bg-[#22364d]"
            >
              {t.hero.primary}
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </a>
            <a
              href="#projects"
              className="inline-flex items-center rounded-full border border-ink/25 px-7 py-4 text-sm font-medium transition-colors hover:border-ink"
            >
              {t.hero.secondary}
            </a>
          </motion.div>
        </div>

        <motion.div style={{ y: logoY, rotate: logoRotate }} className="relative mx-auto w-full max-w-[460px] md:col-span-5">
          <Logo animate className="w-full text-ink" strokeWidth={1.6} />
          {/* Drafting annotations around the mark */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.8, duration: 1 }}
            className="pointer-events-none absolute inset-0 font-mono text-[10px] tracking-widest text-muted"
          >
            <span className="absolute left-[8%] top-[6%]">R 100</span>
            <span className="absolute bottom-[4%] right-[10%]">Ø 200</span>
            <span className="absolute right-[2%] top-[34%]">20°</span>
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2">
              <span className="absolute left-1/2 top-0 h-full w-px bg-muted" />
              <span className="absolute left-0 top-1/2 h-px w-full bg-muted" />
            </span>
          </motion.div>
        </motion.div>
      </div>

      <motion.a
        href="#stats"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.4 }}
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted md:flex"
      >
        {t.hero.scroll}
        <span className="relative h-10 w-px overflow-hidden bg-line">
          <motion.span
            className="absolute inset-x-0 top-0 h-1/2 bg-ink"
            animate={{ y: ["-100%", "200%"] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          />
        </span>
      </motion.a>
    </section>
  );
}
