"use client";

import { useLang } from "@/lib/i18n";
import { Reveal, SectionHead } from "./ui";

export function Services() {
  const { t } = useLang();
  return (
    <section id="services" className="scroll-mt-20 py-24 md:py-36">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHead eyebrow={t.services.eyebrow} title={t.services.title} lead={t.services.lead} />

        <div className="mt-16 grid gap-4 md:mt-24 md:grid-cols-2 md:gap-6">
          {t.services.items.map((s, i) => (
            <Reveal key={s.code} delay={i * 0.1}>
              <article className="group relative h-full overflow-hidden rounded-2xl border border-line bg-surface p-8 transition-colors duration-500 hover:bg-ink hover:text-surface md:p-12">
                <div className="flex items-start justify-between">
                  <span className="font-display text-[8rem] font-extralight leading-none text-line transition-colors duration-500 group-hover:text-sand/60 md:text-[9rem]">
                    {s.code}
                  </span>
                  <span className="font-mono text-xs text-muted">0{i + 1}</span>
                </div>
                <h3 className="mt-6 font-display text-3xl font-normal uppercase tracking-[0.03em] md:text-4xl">{s.title}</h3>
                <p className="mt-4 max-w-md leading-relaxed text-ink-soft transition-colors duration-500 group-hover:text-surface/70">
                  {s.text}
                </p>
                <ul className="mt-8 border-t border-line transition-colors duration-500 group-hover:border-surface/15">
                  {s.list.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-4 border-b border-line py-3.5 text-[15px] transition-colors duration-500 group-hover:border-surface/15"
                    >
                      <span className="h-px w-4 bg-current opacity-50" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
