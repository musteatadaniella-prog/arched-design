"use client";

import Script from "next/script";
import { useCallback, useRef, useState } from "react";
import { dicts, type Lang } from "@/content/dict";
import { CrmView } from "./CrmView";
import { DesignView } from "./DesignView";

// The parts of window.Telegram.WebApp this page uses.
type WebApp = {
  initData: string;
  initDataUnsafe: { user?: { language_code?: string } };
  ready(): void;
  expand(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  HapticFeedback?: {
    selectionChanged(): void;
    notificationOccurred(type: "success" | "error"): void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
  }
}

type SentRequest = { id: string; created_at: string; status: string; project_type: string | null };

const copy = {
  ro: {
    hello: "Bună",
    lead: "Acesta este cabinetul dvs.: aici vedeți cererile trimise și la ce etapă sunt. Pentru o cerere nouă, alegeți serviciul de mai jos.",
    newRequest: "Cerere nouă",
    tabCrm: "CRM",
    tabClient: "Cabinetul meu",
    tabDesign: "Vizualizare",
    catalog: "Servicii",
    details: "Detalii",
    phone: "Telefon",
    area: "Suprafață estimată (m²)",
    comment: "Spuneți-ne mai multe",
    optional: "opțional",
    pick: "Alegeți un serviciu din listă.",
    send: "Trimite cererea",
    sending: "Se trimite…",
    sent: "Cererea a fost trimisă. Vă contactăm în curând.",
    again: "Trimite altă cerere",
    mine: "Cererile mele",
    none: "Nu ați trimis încă nicio cerere.",
    server: "Nu am putut trimite cererea. Încercați din nou.",
    loadFailed: "Nu am putut încărca datele. Închideți și redeschideți aplicația.",
    outsideTitle: "Deschideți în Telegram",
    outsideText: "Această pagină funcționează doar în botul ARCHED design din Telegram.",
    openBot: "Deschide botul",
    status: { new: "Primită", contacted: "În discuție", proposal: "Ofertă trimisă", paid: "În lucru", lost: "Închisă" },
  },
  en: {
    hello: "Hi",
    lead: "This is your account: here you see the requests you sent and the stage each one is at. For a new request, pick a service below.",
    newRequest: "New request",
    tabCrm: "CRM",
    tabClient: "My account",
    tabDesign: "Visualize",
    catalog: "Services",
    details: "Details",
    phone: "Phone",
    area: "Estimated area (m²)",
    comment: "Tell us more",
    optional: "optional",
    pick: "Pick a service from the list.",
    send: "Send request",
    sending: "Sending…",
    sent: "Your request has been sent. We will be in touch soon.",
    again: "Send another request",
    mine: "My requests",
    none: "You have not sent any requests yet.",
    server: "We could not send your request. Please try again.",
    loadFailed: "We could not load your data. Close and reopen the app.",
    outsideTitle: "Open in Telegram",
    outsideText: "This page only works inside the ARCHED design Telegram bot.",
    openBot: "Open the bot",
    status: { new: "Received", contacted: "In discussion", proposal: "Proposal sent", paid: "In progress", lost: "Closed" },
  },
} as const;

type Phase = "loading" | "outside" | "failed" | "ready";
type Tab = "crm" | "client" | "design";

export function MiniApp({ bot }: { bot: string }) {
  const app = useRef<WebApp | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [lang, setLang] = useState<Lang>("ro");
  const [firstName, setFirstName] = useState("");
  const [requests, setRequests] = useState<SentRequest[]>([]);
  const [staff, setStaff] = useState(false);
  const [tab, setTab] = useState<Tab>("client");

  const [service, setService] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const c = copy[lang];
  const t = dicts[lang];

  const api = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(path, {
        ...init,
        headers: { ...init?.headers, Authorization: `tma ${app.current?.initData ?? ""}` },
      }),
    [],
  );

  const load = useCallback(async () => {
    const res = await api("/api/tg/me");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error("load");
    setFirstName(data.firstName);
    setRequests(data.requests);
    setStaff(data.staff);
    return data.staff as boolean;
  }, [api]);

  const haptic = useCallback(
    (ok: boolean) => app.current?.HapticFeedback?.notificationOccurred(ok ? "success" : "error"),
    [],
  );

  // Runs once telegram-web-app.js has loaded. In a plain browser initData is
  // empty, so nothing is requested from the server.
  const start = useCallback(() => {
    const wa = window.Telegram?.WebApp;
    if (!wa?.initData) {
      setPhase("outside");
      return;
    }
    app.current = wa;
    if (wa.initDataUnsafe.user?.language_code === "en") setLang("en");
    wa.ready();
    wa.expand();
    wa.setHeaderColor?.("#eae3e0");
    wa.setBackgroundColor?.("#eae3e0");
    load()
      .then((isStaff) => {
        // Staff land on the funnel; clients on their own account.
        if (isStaff) setTab("crm");
        setPhase("ready");
      })
      .catch(() => setPhase("failed"));
  }, [load]);

  function pick(s: string) {
    setService(s);
    setErrors((e) => ({ ...e, service: "" }));
    app.current?.HapticFeedback?.selectionChanged();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!service) next.service = c.pick;
    const digits = phone.replace(/\D/g, "");
    if (!phone.trim()) next.phone = t.contact.errors.required;
    else if (!/^[+\d\s()-]+$/.test(phone) || digits.length < 7 || digits.length > 15) next.phone = t.contact.errors.phone;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSending(true);
    setFailed(false);
    try {
      const res = await api("/api/tg/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, phone, area, comment, lang }),
      });
      if (!res.ok) throw new Error("send");
      app.current?.HapticFeedback?.notificationOccurred("success");
      setSent(true);
      setService("");
      setArea("");
      setComment("");
      await load().catch(() => {});
    } catch {
      app.current?.HapticFeedback?.notificationOccurred("error");
      setFailed(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-bg px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6 text-ink">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onReady={start} onError={() => setPhase("outside")} />

      <p className="font-display text-sm uppercase tracking-[0.2em]">ARCHED design</p>

      {phase === "loading" && <p className="mt-10 text-sm text-muted">…</p>}

      {phase === "outside" && (
        <section className="mt-10 border border-line bg-surface p-6">
          <h1 className="font-display text-3xl uppercase">{c.outsideTitle}</h1>
          <p className="mt-3 text-sm text-ink-soft">{c.outsideText}</p>
          {bot && (
            <a
              href={`https://t.me/${bot}`}
              className="mt-6 inline-block bg-ink px-5 py-3 font-mono text-xs uppercase tracking-[0.15em] text-surface"
            >
              {c.openBot}
            </a>
          )}
        </section>
      )}

      {phase === "failed" && <p className="mt-10 text-sm text-[#b4533f]">{c.loadFailed}</p>}

      {phase === "ready" && (
        <>
          <h1 className="mt-4 break-words font-display text-4xl uppercase">
            {c.hello}, {firstName}!
          </h1>

          <div className={`mt-5 grid border border-ink ${staff ? "grid-cols-3" : "grid-cols-2"}`}>
            {(staff ? (["crm", "client", "design"] as const) : (["client", "design"] as const)).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  aria-pressed={tab === k}
                  className={`px-2 py-3 font-mono text-[11px] uppercase tracking-[0.12em] ${
                    tab === k ? "bg-ink text-surface" : "bg-surface text-ink"
                  }`}
                >
                  {{ crm: c.tabCrm, client: c.tabClient, design: c.tabDesign }[k]}
                </button>
              ))}
          </div>

          {tab === "crm" ? (
            <CrmView api={api} haptic={haptic} />
          ) : tab === "design" ? (
            <DesignView api={api} haptic={haptic} lang={lang} />
          ) : (
            <>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{c.lead}</p>

              <section className="mt-8">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">{c.mine}</h2>
                {requests.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">{c.none}</p>
                ) : (
                  <ul className="mt-3 grid gap-2">
                    {requests.map((r) => (
                      <li key={r.id} className="border border-line bg-surface p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words text-[15px]">{r.project_type}</p>
                            <p className="mt-1 font-mono text-[11px] text-muted">
                              {new Date(r.created_at).toLocaleDateString(lang === "en" ? "en-GB" : "ro-RO")}
                            </p>
                          </div>
                          <span className="shrink-0 border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em]">
                            {c.status[r.status as keyof typeof c.status] ?? r.status}
                          </span>
                        </div>
                        <Progress status={r.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <h2 className="mt-10 font-display text-2xl uppercase">{c.newRequest}</h2>
              {sent ? (
                <section className="mt-8 border border-line bg-surface p-6">
                  <p className="text-[15px]">{c.sent}</p>
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="mt-5 w-full border border-ink px-5 py-3 font-mono text-xs uppercase tracking-[0.15em]"
                  >
                    {c.again}
                  </button>
                </section>
              ) : (
                <form onSubmit={submit} noValidate className="mt-8">
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">{c.catalog}</h2>
                  <div className="mt-3 grid gap-3">
                    {t.services.items.map((s) => (
                      <section key={s.code} className="border border-line bg-surface p-4">
                        <h3 className="font-display text-xl uppercase">{s.title}</h3>
                        <p className="mt-1 text-sm text-ink-soft">{s.text}</p>
                        <div className="mt-3 grid gap-2">
                          {s.list.map((item) => {
                            const on = service === item;
                            return (
                              <button
                                key={item}
                                type="button"
                                aria-pressed={on}
                                onClick={() => pick(item)}
                                className={`border px-3 py-3 text-left text-[15px] transition-colors ${
                                  on ? "border-ink bg-ink text-surface" : "border-line bg-bg/40"
                                }`}
                              >
                                {item}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                  {errors.service && (
                    <p role="alert" className="mt-2 text-sm text-[#b4533f]">
                      {errors.service}
                    </p>
                  )}
    
                  <h2 className="mt-8 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">{c.details}</h2>
                  <div className="mt-3 grid gap-4 border border-line bg-surface p-4">
                    <Field label={c.phone} error={errors.phone}>
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={input}
                      />
                    </Field>
                    <Field label={`${c.area} · ${c.optional}`}>
                      <input inputMode="numeric" value={area} onChange={(e) => setArea(e.target.value)} className={input} />
                    </Field>
                    <Field label={`${c.comment} · ${c.optional}`}>
                      <textarea
                        rows={3}
                        maxLength={2000}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className={input}
                      />
                    </Field>
                  </div>
    
                  {failed && (
                    <p role="alert" className="mt-4 text-sm text-[#b4533f]">
                      {c.server}
                    </p>
                  )}
    
                  <button
                    type="submit"
                    disabled={sending}
                    className="mt-6 w-full bg-ink px-5 py-4 font-mono text-xs uppercase tracking-[0.15em] text-surface disabled:opacity-60"
                  >
                    {sending ? c.sending : c.send}
                  </button>
                </form>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}

// Where the request is in the funnel: received → in discussion → proposal → in progress.
const STEPS = ["new", "contacted", "proposal", "paid"];

function Progress({ status }: { status: string }) {
  if (status === "lost") return null;
  const at = STEPS.indexOf(status);
  return (
    <div className="mt-3 grid grid-cols-4 gap-1" aria-hidden>
      {STEPS.map((s, i) => (
        <span key={s} className={`h-1 ${i <= at ? "bg-ink" : "bg-line"}`} />
      ))}
    </div>
  );
}

const input = "w-full border border-line bg-white px-3 py-3 text-base outline-none focus:border-ink";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{label}</span>
      {children}
      {error && <span className="text-sm text-[#b4533f]">{error}</span>}
    </label>
  );
}
