"use client";

import { useLang } from "@/lib/i18n";
import { Logo } from "./Logo";

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="bg-ink text-surface">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex items-end justify-between gap-6 border-t border-surface/15 py-10">
          <div className="flex items-center gap-4">
            <Logo className="h-12 w-12" strokeWidth={5} />
            <div>
              <p className="font-display text-base font-normal uppercase tracking-[0.25em]">
                ARCHED <span className="font-light tracking-[0.2em] text-sand">design</span>
              </p>
              <p className="mt-1 text-xs text-surface/50">{t.footer.tagline}</p>
            </div>
          </div>
          <p className="text-right text-xs text-surface/50">
            © {new Date().getFullYear()} ARCHED design. {t.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
