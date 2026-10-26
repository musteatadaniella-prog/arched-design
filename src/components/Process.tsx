"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { useRef } from "react";
import { useLang } from "@/lib/i18n";
import { Reveal, SectionHead } from "./ui";

export function Process() {
  const { t } = useLang();
  const listRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start 75%", "end 60%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <section id="process" className="scroll-mt-20 py-24 md:py-36">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHead eyebrow={t.process.eyebrow} title={t.process.title} />

        <div className="mt-16 grid md:mt-24 md:grid-cols-12">
          <ol ref={listRef} className="relative md:col-span-8 md:col-start-5">
            {/* The timeline line traces itself as you scroll */}
            <span className="absolute bottom-0 left-[11px] top-0 w-px bg-line" />
            <motion.span
              style={{ scaleY: progress }}
              className="absolute bottom-0 left-[11px] top-0 w-px origin-top bg-ink"
            />
            {t.process.steps.map((s, i) => (
              <li key={s.title} className="relative pb-14 pl-14 last:pb-0">
                <span className="absolute left-0 top-1 flex h-[23px] w-[23px] items-center justify-center rounded-full border border-ink bg-bg">
                  <span className="h-1.5 w-1.5 rounded-full bg-sand" />
                </span>
                <Reveal>
                  <p className="font-mono text-xs tracking-widest text-muted">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-2 font-display text-3xl font-normal uppercase tracking-[0.03em] md:text-4xl">{s.title}</h3>
                  <p className="mt-3 max-w-lg leading-relaxed text-ink-soft">{s.text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
