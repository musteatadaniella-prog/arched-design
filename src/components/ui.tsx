"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

// A dimension line (cotă) that draws itself when it enters the viewport.
export function DimensionLine({ label }: { label?: string }) {
  return (
    <div className="relative flex items-center gap-3 text-muted">
      <span className="h-3 w-px bg-current" />
      <motion.span
        className="h-px flex-1 origin-left bg-current"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease }}
      />
      {label && <span className="font-mono text-[11px] tracking-widest">{label}</span>}
      <motion.span
        className="h-px flex-1 origin-right bg-current"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease }}
      />
      <span className="h-3 w-px bg-current" />
    </div>
  );
}

export function SectionHead({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="grid gap-6 md:grid-cols-12 md:gap-10">
      <Reveal className="md:col-span-4">
        <p className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">
          <span className="h-px w-8 bg-sand" />
          {eyebrow}
        </p>
      </Reveal>
      <div className="md:col-span-8">
        <Reveal>
          <h2 className="font-display text-5xl font-light uppercase leading-[1] tracking-[0.02em] text-balance md:text-7xl">
            {title}
          </h2>
        </Reveal>
        {lead && (
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">{lead}</p>
          </Reveal>
        )}
      </div>
    </div>
  );
}
