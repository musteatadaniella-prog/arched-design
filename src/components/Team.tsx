"use client";

import { useLang } from "@/lib/i18n";
import { Reveal, SectionHead } from "./ui";

export function Team() {
  const { t } = useLang();
  return (
    <section id="team" className="scroll-mt-20 border-t border-line py-24 md:py-36">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHead eyebrow={t.team.eyebrow} title={t.team.title} />
        <div className="mt-16 grid grid-cols-2 gap-x-4 gap-y-10 md:mt-24 lg:grid-cols-4 lg:gap-6">
          {t.team.members.map((m, i) => {
            const initials = m.name
              .split(" ")
              .map((w) => w[0])
              .join("");
            return (
              <Reveal key={m.name} delay={i * 0.08}>
                <div className="group">
                  {/* Placeholder portrait: replace with a photo */}
                  <div className="relative flex aspect-[3/4] items-end overflow-hidden rounded-xl border border-line bg-surface p-5">
                    <span className="font-display text-7xl font-extralight text-line transition-colors duration-500 group-hover:text-ink md:text-7xl">
                      {initials}
                    </span>
                    <span className="absolute right-5 top-5 h-6 w-6 rounded-full border border-line transition-colors duration-500 group-hover:border-ink" />
                  </div>
                  <h3 className="mt-4 font-display text-xl font-normal uppercase tracking-[0.05em]">{m.name}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{m.role}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
