"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useLang } from "@/lib/i18n";

// A full-width render that opens up from an inset frame as it scrolls into view.
export function ImageBand() {
  const { t } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const inset = useTransform(scrollYProgress, [0, 1], [12, 0]);
  const clipPath = useTransform(inset, (v) => `inset(${v}% ${v}% ${v}% ${v}% round ${v / 2}px)`);
  const scale = useTransform(scrollYProgress, [0, 1], [1.2, 1]);

  return (
    <section ref={ref} className="relative">
      <motion.div style={{ clipPath }} className="relative h-[70svh] overflow-hidden md:h-[92svh]">
        <motion.div style={{ scale }} className="absolute inset-0">
          <Image src="/projects/casa-stanca.webp" alt={t.band.caption} fill sizes="100vw" className="object-cover" />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
        <p className="absolute bottom-6 left-4 right-4 max-w-md font-mono text-[11px] uppercase leading-relaxed tracking-[0.18em] text-white/90 md:bottom-10 md:left-8">
          <span className="mr-3 inline-block h-px w-8 bg-sand align-middle" />
          {t.band.caption}
        </p>
      </motion.div>
    </section>
  );
}
