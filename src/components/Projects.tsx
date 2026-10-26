"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useLang } from "@/lib/i18n";
import { SectionHead } from "./ui";

// Alternating wide / narrow columns give the grid an editorial rhythm.
const spans = ["md:col-span-7", "md:col-span-5", "md:col-span-5", "md:col-span-7"];

export function Projects() {
  const { t } = useLang();

  return (
    <section id="projects" className="scroll-mt-20 bg-surface py-24 md:py-36">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHead eyebrow={t.projects.eyebrow} title={t.projects.title} lead={t.projects.lead} />

        <div className="mt-16 grid gap-x-6 gap-y-14 md:mt-24 md:grid-cols-12">
          {t.projects.items.map((p, i) => (
            <motion.a
              key={p.image}
              href="#contact"
              initial="hidden"
              whileInView="shown"
              viewport={{ once: true, margin: "-80px" }}
              variants={{ hidden: { opacity: 0, y: 40 }, shown: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.9, delay: (i % 2) * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className={`group block ${spans[i % spans.length]}`}
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-bg">
                <Image
                  src={p.image}
                  alt={p.name}
                  fill
                  sizes="(min-width: 768px) 60vw, 100vw"
                  className="object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/0 to-ink/0 opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
                <span className="absolute left-5 top-5 font-mono text-[11px] tracking-widest text-white/80">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="absolute inset-x-5 bottom-5 flex translate-y-3 items-end justify-between font-mono text-[11px] uppercase tracking-widest text-white opacity-0 transition-all duration-700 group-hover:translate-y-0 group-hover:opacity-100">
                  <span>{p.area}</span>
                  <span className="text-sand">→</span>
                </div>
                {/* Curtain that lifts off the photo when the card scrolls into view */}
                <motion.div
                  variants={{ hidden: { scaleY: 1 }, shown: { scaleY: 0 } }}
                  transition={{ duration: 1.2, delay: 0.15 + (i % 2) * 0.12, ease: [0.65, 0, 0.35, 1] }}
                  className="absolute inset-0 origin-top bg-surface"
                />
              </div>
              <div className="mt-5 flex items-baseline justify-between gap-4 border-b border-line pb-4">
                <h3 className="font-display text-2xl font-normal uppercase tracking-[0.04em] md:text-3xl">{p.name}</h3>
                <span className="shrink-0 text-right font-mono text-xs text-muted">
                  {p.type} · {p.year}
                </span>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
