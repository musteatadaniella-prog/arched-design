"use client";

import { animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { Reveal } from "./ui";

function Counter({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, { duration: 2, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setN(Math.round(v)) });
    return () => controls.stop();
  }, [inView, to]);

  return (
    <span ref={ref}>
      {n}
      <span className="text-sand">{suffix}</span>
    </span>
  );
}

export function Stats() {
  const { t } = useLang();
  return (
    <section id="stats" className="border-y border-line">
      <div className="mx-auto grid max-w-7xl grid-cols-2 px-4 md:grid-cols-4 md:px-8">
        {t.stats.map((s, i) => (
          <Reveal
            key={i}
            delay={i * 0.08}
            className={`py-10 md:py-14 ${i % 2 === 1 ? "pl-6 md:pl-8" : ""} ${i > 0 ? "md:border-l md:border-line md:pl-8" : ""} ${
              i % 2 === 1 ? "border-l border-line" : ""
            } ${i >= 2 ? "border-t border-line md:border-t-0" : ""}`}
          >
            <p className="font-display text-6xl font-extralight md:text-7xl">
              <Counter to={s.value} suffix={s.suffix} />
            </p>
            <p className="mt-3 text-sm text-ink-soft">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
