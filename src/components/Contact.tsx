"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { validateLead, type LeadErrors, type LeadKind } from "@/lib/lead";
import { Reveal } from "./ui";

const SLOTS = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00"];

function nextWorkdays(count: number) {
  const days: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (days.length < count) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) days.push(new Date(d));
  }
  return days;
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const inputCls =
  "w-full border-b bg-transparent py-3 text-surface placeholder:text-surface/40 outline-none transition-colors focus:border-surface";

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-surface/50">{label}</span>
      {children}
      <AnimatePresence>
        {error && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="mt-2 block text-[13px] text-[#f2a99b]"
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </label>
  );
}

export function Contact() {
  const { t, lang } = useLang();
  const c = t.contact;
  const [tab, setTab] = useState<LeadKind>("quote");
  const [days, setDays] = useState<Date[]>([]);
  const [day, setDay] = useState<number | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [errors, setErrors] = useState<LeadErrors>({});
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // Dates are computed on the client so they always match the visitor's today.
  useEffect(() => setDays(nextWorkdays(10)), []);

  const fmt = (d: Date) => `${t.weekdays[d.getDay()]} ${d.getDate()} ${t.months[d.getMonth()]}`;
  const err = (k: keyof LeadErrors) => (errors[k] ? c.errors[errors[k]!] : undefined);
  const borderCls = (k: keyof LeadErrors) => (errors[k] ? "border-[#f2a99b]" : "border-surface/25");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      kind: tab,
      name: form.get("name"),
      phone: form.get("phone"),
      comment: form.get("comment"),
      email: form.get("email"),
      projectType: form.get("projectType"),
      area: form.get("area"),
      meetingDate: day !== null && days[day] ? isoDay(days[day]) : "",
      meetingTime: slot ?? "",
      website: form.get("website"),
      lang,
    };

    const { errors: found } = validateLead(payload);
    setErrors(found);
    setServerError(false);
    if (Object.keys(found).length > 0) return;

    setSending(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (data.errors) setErrors(data.errors);
        else setServerError(true);
        return;
      }
      setDone(tab === "meeting" && day !== null ? `${c.booked} ${fmt(days[day])}, ${slot}.` : c.sent);
    } catch {
      setServerError(true);
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setDone(null);
    setDay(null);
    setSlot(null);
    setErrors({});
    setServerError(false);
  };

  return (
    <section id="contact" className="scroll-mt-20 bg-ink py-24 text-surface md:py-36">
      <div className="mx-auto grid max-w-7xl gap-16 px-4 md:grid-cols-12 md:px-8">
        <div className="min-w-0 md:col-span-5">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-sand">{c.eyebrow}</p>
            <h2 className="mt-6 font-display text-5xl font-light uppercase leading-[1] tracking-[0.02em] text-balance md:text-7xl">
              {c.title}
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-surface/70">{c.lead}</p>
          </Reveal>

          <Reveal delay={0.1} className="mt-12 space-y-6 border-t border-surface/15 pt-8 text-sm">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-surface/50">{c.office}</p>
              <p className="mt-2">{c.address}</p>
              <p className="text-surface/60">{c.hours}</p>
            </div>
            <div className="space-y-1">
              <a href={`tel:${c.phoneValue.replace(/\s/g, "")}`} className="block hover:underline">
                {c.phoneValue}
              </a>
              <a href={`mailto:${c.emailValue}`} className="block hover:underline">
                {c.emailValue}
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="min-w-0 md:col-span-7">
          <div className="rounded-2xl border border-surface/15 p-6 md:p-10">
            <div className="flex gap-1 rounded-full border border-surface/15 p-1">
              {(["quote", "meeting"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    setTab(k);
                    reset();
                  }}
                  className={`flex-1 rounded-full px-4 py-2.5 text-sm transition-colors ${
                    tab === k ? "bg-surface text-ink" : "text-surface/70 hover:text-surface"
                  }`}
                >
                  {c.tabs[k]}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {done ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  role="status"
                  className="flex min-h-[420px] flex-col items-start justify-center"
                >
                  <svg viewBox="0 0 48 48" className="h-12 w-12 text-sand" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <motion.circle cx="24" cy="24" r="22" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} />
                    <motion.path d="M15 24.5l6 6 12-13" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.6, duration: 0.5 }} />
                  </svg>
                  <p className="mt-6 font-display text-3xl font-light uppercase tracking-[0.03em]">{done}</p>
                  <button onClick={reset} className="mt-6 text-sm text-surface/60 underline-offset-4 hover:underline">
                    {c.again}
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key={tab}
                  onSubmit={submit}
                  noValidate
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="mt-8 grid grid-cols-1 gap-7 sm:grid-cols-2 [&>*]:min-w-0"
                >
                  {/* Honeypot: hidden from people, tempting for bots */}
                  <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

                  <Field label={c.fields.name} error={err("name")}>
                    <input name="name" autoComplete="name" aria-invalid={!!errors.name} className={`${inputCls} ${borderCls("name")}`} />
                  </Field>
                  <Field label={c.fields.phone} error={err("phone")}>
                    <input
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      aria-invalid={!!errors.phone}
                      className={`${inputCls} ${borderCls("phone")}`}
                    />
                  </Field>

                  {tab === "quote" ? (
                    <>
                      <Field label={c.fields.type}>
                        <select name="projectType" defaultValue="" className={`${inputCls} border-surface/25 [&>option]:text-ink`}>
                          <option value="">—</option>
                          {c.types.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label={c.fields.area}>
                        <input name="area" type="number" min={1} inputMode="numeric" className={`${inputCls} border-surface/25`} />
                      </Field>
                    </>
                  ) : (
                    <>
                      <div className="sm:col-span-2">
                        <Field label={c.fields.email} error={err("email")}>
                          <input
                            name="email"
                            type="email"
                            autoComplete="email"
                            aria-invalid={!!errors.email}
                            className={`${inputCls} ${borderCls("email")}`}
                          />
                        </Field>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-surface/50">{c.fields.date}</span>
                        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                          {days.map((d, i) => (
                            <button
                              type="button"
                              key={d.toISOString()}
                              onClick={() => setDay(i)}
                              className={`shrink-0 rounded-lg border px-3 py-2.5 text-center text-sm transition-colors ${
                                day === i ? "border-surface bg-surface text-ink" : "border-surface/20 hover:border-surface/60"
                              }`}
                            >
                              <span className="block font-mono text-[10px] uppercase opacity-60">{t.weekdays[d.getDay()]}</span>
                              <span className="block font-display text-xl font-normal">{d.getDate()}</span>
                              <span className="block text-[11px] opacity-60">{t.months[d.getMonth()]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-surface/50">{c.fields.time}</span>
                        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                          {SLOTS.map((s) => (
                            <button
                              type="button"
                              key={s}
                              disabled={day === null}
                              onClick={() => setSlot(s)}
                              className={`rounded-lg border py-2.5 font-mono text-sm transition-colors disabled:opacity-30 ${
                                slot === s ? "border-surface bg-surface text-ink" : "border-surface/20 hover:border-surface/60"
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                        {errors.slot && (
                          <p role="alert" className="mt-2 text-[13px] text-[#f2a99b]">
                            {c.errors.slot}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  <div className="sm:col-span-2">
                    <Field label={c.fields.message} error={err("comment")}>
                      <textarea name="comment" rows={3} maxLength={2000} className={`${inputCls} ${borderCls("comment")} resize-none`} />
                    </Field>
                  </div>

                  <div className="sm:col-span-2">
                    {serverError && (
                      <p role="alert" className="mb-4 text-[13px] text-[#f2a99b]">
                        {c.errors.server}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={sending}
                      className="group inline-flex items-center gap-3 rounded-full bg-surface px-7 py-4 text-sm font-medium text-ink transition-opacity disabled:opacity-60"
                    >
                      {sending ? c.sending : tab === "quote" ? c.send : c.book}
                      <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
