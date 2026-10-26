"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "./Logo";
import { useLang } from "@/lib/i18n";

export function Header() {
  const { t, lang, setLang } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    ["#services", t.nav.services],
    ["#projects", t.nav.projects],
    ["#process", t.nav.process],
    ["#team", t.nav.team],
    ["#faq", t.nav.faq],
  ] as const;

  const langToggle = (
    <div className="flex items-center rounded-full border border-line p-0.5 font-mono text-[11px]">
      {(["ro", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded-full px-2.5 py-1 uppercase transition-colors ${
            lang === l ? "bg-ink text-surface" : "text-ink-soft hover:text-ink"
          }`}
          aria-pressed={lang === l}
        >
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? "border-b border-line/70 bg-bg/80 backdrop-blur-md" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:h-20 md:px-8">
        <a href="#top" className="flex items-center gap-2.5" aria-label="ARCHED design">
          <Logo className="h-8 w-8 md:h-9 md:w-9" strokeWidth={7} />
          <span className="font-display text-[17px] font-normal uppercase tracking-[0.25em]">
            ARCHED <span className="font-light tracking-[0.2em] text-muted">design</span>
          </span>
        </a>

        <nav className="hidden items-center gap-8 lg:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="group relative text-sm text-ink-soft transition-colors hover:text-ink">
              {label}
              <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-ink transition-transform duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          {langToggle}
          <a
            href="#contact"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-[#22364d]"
          >
            {t.nav.cta}
          </a>
        </div>

        <div className="flex items-center gap-3 lg:hidden">
          {langToggle}
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5"
            aria-label="Menu"
            aria-expanded={open}
          >
            <span className={`h-px w-6 bg-ink transition-transform ${open ? "translate-y-[3.5px] rotate-45" : ""}`} />
            <span className={`h-px w-6 bg-ink transition-transform ${open ? "-translate-y-[3.5px] -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line bg-bg lg:hidden"
          >
            <div className="flex flex-col px-4 py-4">
              {links.map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="border-b border-line/60 py-4 font-display text-3xl font-light uppercase"
                >
                  {label}
                </a>
              ))}
              <a
                href="#contact"
                onClick={() => setOpen(false)}
                className="mt-6 rounded-full bg-ink py-3.5 text-center font-medium text-surface"
              >
                {t.nav.cta}
              </a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
