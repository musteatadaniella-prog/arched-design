"use client";

import { motion } from "framer-motion";

type Props = {
  className?: string;
  animate?: boolean;
  strokeWidth?: number;
};

// Recreated from the brand mark: an open circle around an arch on a base line.
const RING = "M220 120 A100 100 0 1 1 213.97 85.8";
const BASE = "M75 163 H154";
const ARCH = "M97 163 V122 A45.5 39 0 0 1 188 122";

export function Logo({ className, animate = false, strokeWidth = 3 }: Props) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "square" as const,
  };

  if (!animate) {
    return (
      <svg viewBox="0 0 240 240" className={className} aria-hidden>
        <path d={RING} {...common} />
        <path d={BASE} {...common} />
        <path d={ARCH} {...common} />
      </svg>
    );
  }

  const draw = (delay: number, duration: number) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: {
      pathLength: { delay, duration, ease: [0.65, 0, 0.35, 1] as const },
      opacity: { delay, duration: 0.01 },
    },
  });

  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      <motion.path d={RING} {...common} {...draw(0.2, 1.8)} />
      <motion.path d={BASE} {...common} {...draw(1.4, 0.6)} />
      <motion.path d={ARCH} {...common} {...draw(1.8, 1.1)} />
    </svg>
  );
}
